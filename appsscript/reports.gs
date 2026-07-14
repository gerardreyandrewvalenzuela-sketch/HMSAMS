// ============================================================
// reports.gs
// Attendance Summary Report
// ============================================================

function generateAttendanceReport() {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var attendanceSheet = ss.getSheetByName(CONFIG.SHEETS.ATTENDANCE);
  var studentSheet    = ss.getSheetByName(CONFIG.SHEETS.STUDENTS);

  var reportSheet = ss.getSheetByName("Attendance Report");

  if (!reportSheet) {
    reportSheet = ss.insertSheet("Attendance Report");
  }

  reportSheet.clear();

  reportSheet.appendRow([
    "Student No",
    "Student Name",
    "Year Level",
    "Block",
    "Event",
    "Attendance Status",
    "Time In",
    "Time Out"
  ]);

  var attendance = attendanceSheet.getDataRange().getValues();
  var students   = studentSheet.getDataRange().getValues();

  // Build Student Lookup
  var studentMap = {};

  for (var i = 1; i < students.length; i++) {

    studentMap[String(students[i][0])] = {
      year: students[i][5],
      block: students[i][6]
    };

  }

  var rows = [];

  for (var i = 1; i < attendance.length; i++) {

    var studentNo = String(attendance[i][ATT_COLS.STUDENT_NO]);

    var info = studentMap[studentNo] || {
      year: "",
      block: ""
    };

    rows.push([
      studentNo,
      attendance[i][ATT_COLS.FULL_NAME],
      info.year,
      info.block,
      attendance[i][ATT_COLS.EVENT_NAME],
      attendance[i][ATT_COLS.STATUS],
      attendance[i][ATT_COLS.TIME_IN],
      attendance[i][ATT_COLS.TIME_OUT]
    ]);

  }

  if (rows.length) {
    reportSheet
      .getRange(2,1,rows.length,rows[0].length)
      .setValues(rows);
  }

  reportSheet.autoResizeColumns(1,8);

  SpreadsheetApp.getUi().alert("Attendance Report Generated!");
}
