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
 * columns of the existing expense register. Column H (Record ID) is added and
 * auto-hidden on every sheet this touches -- it's how edits/deletes find the right row
 * later, but nothing else reads it, so it stays out of the way.
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

// Labels column H "Record ID" and hides it -- runs on every sheet, not just ones this
// script creates fresh, since the office's existing TXTAIRE OPC/REF/AVISO tabs already
// had their own 7 columns (A-G) before this script ever touched them. Without this, a
// pre-existing tab's column H shows up as an auto-generated "Column 1" header full of
// internal record IDs, which is exactly the clutter this hides.
function ensureRecordIdColumn_(sheet) {
  var headerCell = sheet.getRange(1, 8);
  if (headerCell.getValue() !== 'Record ID') headerCell.setValue('Record ID');
  if (!sheet.isColumnHiddenByUser(8)) sheet.hideColumns(8);
}

function getOrCreateSheet_(entityName) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(entityName);
  if (!sheet) {
    sheet = ss.insertSheet(entityName);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  ensureRecordIdColumn_(sheet);
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

// Matches the look of the office's existing hand-entered rows: a real Date value
// (formatted d-mmm-yy, e.g. "3-Aug-26", same as the rest of the register) rather than
// the literal "2026-08-11" text the dashboard sends, and a proper 2-decimal money format
// on the Amount column -- otherwise a synced row visually stands out from the old ones.
function formatRow_(sheet, rowNum, numCols) {
  sheet.getRange(rowNum, 1).setNumberFormat('d-mmm-yy');
  sheet.getRange(rowNum, 7).setNumberFormat('"PHP" #,##0.00');
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
    body.date ? new Date(body.date + 'T00:00:00') : '', body.invoiceNumber || '', body.vendor || '',
    body.tinNumber || '', body.location || '', body.category || '',
    Number(body.amount) || 0, body.id || '',
  ];

  if (body.action === 'insert') {
    sheet.appendRow(rowValues);
    formatRow_(sheet, sheet.getLastRow(), rowValues.length);
  } else if (body.action === 'update') {
    var found = findRowByIdAnySheet_(body.id);
    if (found && found.sheet.getName() === sheet.getName()) {
      found.sheet.getRange(found.row, 1, 1, rowValues.length).setValues([rowValues]);
      formatRow_(found.sheet, found.row, rowValues.length);
    } else {
      if (found) found.sheet.deleteRow(found.row); // entity changed -- drop the old row
      sheet.appendRow(rowValues);
      formatRow_(sheet, sheet.getLastRow(), rowValues.length);
    }
  } else if (body.action === 'delete') {
    var toDelete = findRowByIdAnySheet_(body.id);
    if (toDelete) toDelete.sheet.deleteRow(toDelete.row);
  }

  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
