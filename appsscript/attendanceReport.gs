// ============================================================
// attendanceReport.gs
// Generates Attendance Report Sheet
// ============================================================

function generateAttendanceReport() {

  var reportSheet = getSheet(CONFIG.SHEETS.ATTENDANCE_REPORT);

  // Clear old report
  reportSheet.clearContents();

  reportSheet.appendRow([
    "Student No",
    "Full Name",
    "Year Level",
    "Block",
    "Event ID",
    "Event Name",
    "Event Date",
    "Attendance Status",
    "Time In",
    "Time Out"
  ]);

  var attendance = getAllRows(CONFIG.SHEETS.ATTENDANCE);

  if (!attendance.length) {
    return {
      success:true,
      message:"No attendance records."
    };
  }

  var students = getAllRows(CONFIG.SHEETS.STUDENTS);
  var events = getAllRows(CONFIG.SHEETS.EVENTS);

  // Build lookup tables
  var studentMap = {};

  students.forEach(function(s){

    studentMap[String(s["Student No"])] = s;

  });

  var eventMap = {};

  events.forEach(function(e){

    eventMap[String(e["Event ID"])] = e;

  });

  var output = [];

  attendance.forEach(function(a){

    var student = studentMap[String(a["Student No"])] || {};
    var event = eventMap[String(a["Event ID"])] || {};

    output.push([

      a["Student No"],

      a["Full Name"],

      student["Year Level"] || "",

      student["Block"] || "",

      a["Event ID"],

      a["Event Name"],

      event["Date"] || "",

      a["Attendance Status"],

      a["Time In"],

      a["Time Out"]

    ]);

  });

  reportSheet.getRange(
      2,
      1,
      output.length,
      output[0].length
  ).setValues(output);

  // Create filter
  reportSheet.getRange(
      1,
      1,
      reportSheet.getLastRow(),
      reportSheet.getLastColumn()
  ).createFilter();

  // Freeze header
  reportSheet.setFrozenRows(1);

  return {
    success:true,
    message:"Attendance Report generated."
  };


}
