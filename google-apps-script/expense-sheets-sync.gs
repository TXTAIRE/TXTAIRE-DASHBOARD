/**
 * TxTAIRE Expenses -> Google Sheets real-time backup.
 *
 * This file is not deployed automatically -- Google Apps Script has no equivalent of the
 * Supabase CLI/dashboard-paste workflow this project otherwise uses, so it must be set up
 * by hand, once:
 *
 *   1. Open the Google Sheet you want as the live backup (the existing expense register,
 *      or a new one -- either works, since sheet tabs are created automatically if
 *      missing).
 *   2. Extensions -> Apps Script.
 *   3. Delete whatever's in Code.gs, paste this entire file in its place.
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

var HEADERS = ['Date Issued', 'Service/Sales Invoice Number', 'Vendor Name', 'TIN Number', 'Location', 'Particulars/Items', 'Amount', 'Record ID'];

function getOrCreateSheet_(entityName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
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
