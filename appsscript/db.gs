// ============================================================
// db.gs — Google Sheets helper functions
// ============================================================

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// Get all rows as array of objects using first row as headers
function getAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i];
    });
    return obj;
  });
}

// Append a row — values must be in column order
function appendRow(sheetName, values) {
  var sheet = getSheet(sheetName);
  sheet.appendRow(values);
}

// Find row index (1-based) where column matches value, returns -1 if not found
function findRowIndex(sheetName, colIndex, value) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      return i + 1; // sheet rows are 1-based
    }
  }
  return -1;
}

// Update a specific cell
function updateCell(sheetName, rowIndex, colIndex, value) {
  var sheet = getSheet(sheetName);
  sheet.getRange(rowIndex, colIndex).setValue(value);
}

// Update entire row by row index (1-based)
function updateRow(sheetName, rowIndex, values) {
  var sheet = getSheet(sheetName);
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

// Delete a row by row index (1-based)
function deleteRow(sheetName, rowIndex) {
  var sheet = getSheet(sheetName);
  sheet.deleteRow(rowIndex);
}

// Initialize sheets with headers if they don't exist
function initializeSheets() {
  var ss = getSpreadsheet();

  var studentsSheet = ss.getSheetByName(CONFIG.SHEETS.STUDENTS);
  if (!studentsSheet) {
    studentsSheet = ss.insertSheet(CONFIG.SHEETS.STUDENTS);
    studentsSheet.appendRow([
      'Student No', 'Last Name', 'First Name', 'Middle Name',
      'Year Level', 'Block', 'Status'
    ]);
    studentsSheet.setFrozenRows(1);
  }

  var eventsSheet = ss.getSheetByName(CONFIG.SHEETS.EVENTS);
  if (!eventsSheet) {
    eventsSheet = ss.insertSheet(CONFIG.SHEETS.EVENTS);
    eventsSheet.appendRow([
      'Event ID', 'Event Name', 'Date', 'Reg Open',
      'Reg Close', 'Timeout Deadline', 'Status'
    ]);
    eventsSheet.setFrozenRows(1);
  }

  var attendanceSheet = ss.getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  if (!attendanceSheet) {
    attendanceSheet = ss.insertSheet(CONFIG.SHEETS.ATTENDANCE);
    attendanceSheet.appendRow([
      'Log ID', 'Event ID', 'Event Name', 'Student No',
      'Full Name', 'Year Level', 'Block', 'Time In', 'Time Out', 'Attendance Status', 'Scan Count'
    ]);
    attendanceSheet.setFrozenRows(1);
  }

  return { success: true, message: 'Sheets initialized.' };
}
