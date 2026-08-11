/**
 * TxTAIRE Expenses -> Google Sheets real-time backup.
 *
 * This file is not deployed automatically -- Google Apps Script has no equivalent of the
 * Supabase CLI/dashboard-paste workflow this project otherwise uses, so it must be set up
 * by hand, once. Two ways to do that, depending on what your Google account allows:
 *
 * OPTION A -- bound to the sheet (use this if you have it):
 *   1. Open the Google Sheet you want as the live backup.
 *   2. Extensions -> Apps Script.
 *   3. Delete whatever's in Code.gs, paste this entire file in its place.
 *   4. Continue at step 4 below.
 *
 * OPTION B -- standalone script (use this if "Extensions" is missing from the Sheets
 * menu bar -- common on Workspace accounts where an admin has restricted Apps Script
 * access from inside Sheets/Docs, but direct script.google.com access is still allowed):
 *   1. Go to https://script.google.com/ -> New project.
 *   2. Delete whatever's in Code.gs, paste this entire file in its place.
 *   3. Set SPREADSHEET_ID below to the target sheet's ID -- the long string in its URL
 *      between /d/ and /edit (already filled in with the one currently linked).
 *   4. Continue at step 4 below.
 *
 * Both options from here:
 *   4. Change SHARED_SECRET below to a password of your own choosing.
 *   5. Deploy -> New deployment -> gear icon -> "Web app".
 *      Execute as: Me. Who has access: Anyone. Deploy.
 *      (Google will ask you to authorize the script the first time -- that's normal,
 *      it's your own script running under your own account.)
 *   6. Copy the Web app URL it gives you (ends in /exec).
 *   7. In the dashboard: Office & Finance -> Expenses -> "Google Sheets Backup" ->
 *      Connect. Paste the URL and the same secret from step 4.
 *
 * From then on, every expense added/edited/deleted in the dashboard is mirrored here
 * automatically, into a tab per entity (TXTAIRE OPC / TXTAIRE REF / AVISO), matching the
 * columns of the existing expense register. Column H (Record ID) is added automatically
 * to match edits/deletes back to the right row later -- safe to ignore or hide, nothing
 * else reads it.
 */

var SHARED_SECRET = 'CHANGE-THIS-TO-YOUR-OWN-SECRET';

// Only used by Option B (standalone script) -- ignored when this runs as a script bound
// to the sheet itself (Option A), since getSpreadsheet_() below always tries the bound
// spreadsheet first.
var SPREADSHEET_ID = '1ZwMDeTycOWRwd1Q2CAgifHtuGO6xC8Ec';

var HEADERS = ['Date Issued', 'Service/Sales Invoice Number', 'Vendor Name', 'TIN Number', 'Location', 'Particulars/Items', 'Amount', 'Record ID'];

function getSpreadsheet_() {
  var bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(entityName) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(entityName);
  if (!sheet) {
    sheet = ss.insertSheet(entityName);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Searches every tab (not just the one named in the request) since an expense's entity
// can change between an insert and a later edit -- an update/delete has to find wherever
// the row actually is now, not assume it never moved.
function findRowByIdAnySheet_(id) {
  var sheets = getSpreadsheet_().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][7]) === String(id)) return { sheet: sheet, row: i + 1 };
    }
  }
  return null;
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput('Bad request').setMimeType(ContentService.MimeType.TEXT);
  }

  if (!SHARED_SECRET || body.secret !== SHARED_SECRET) {
    return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
  }

  var sheet = getOrCreateSheet_(body.entity || 'TXTAIRE OPC');
  var rowValues = [
    body.date || '', body.invoiceNumber || '', body.vendor || '',
    body.tinNumber || '', body.location || '', body.category || '',
    Number(body.amount) || 0, body.id || '',
  ];

  if (body.action === 'insert') {
    sheet.appendRow(rowValues);
  } else if (body.action === 'update') {
    var found = findRowByIdAnySheet_(body.id);
    if (found && found.sheet.getName() === sheet.getName()) {
      found.sheet.getRange(found.row, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      if (found) found.sheet.deleteRow(found.row); // entity changed -- drop the old row
      sheet.appendRow(rowValues);
    }
  } else if (body.action === 'delete') {
    var toDelete = findRowByIdAnySheet_(body.id);
    if (toDelete) toDelete.sheet.deleteRow(toDelete.row);
  }

  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
