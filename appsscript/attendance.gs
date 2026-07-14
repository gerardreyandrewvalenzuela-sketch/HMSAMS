// ============================================================
// attendance.gs — Attendance scan logic and reporting
// ============================================================

// Column indices for Attendance sheet (0-based)
var ATT_COLS = {
  LOG_ID:     0,
  EVENT_ID:   1,
  EVENT_NAME: 2,
  STUDENT_NO: 3,
  FULL_NAME:  4,
  TIME_IN:    5,
  TIME_OUT:   6,
  STATUS:     7,
  SCAN_COUNT: 8
};

function generateLogId() {
  return 'LOG-' + new Date().getTime();
}

// Main scan handler — called when a student QR URL is opened
function processScan(studentNo, fullName, eventId) {
  var now = new Date();

  // Get event
  var event = getEventById(eventId);
  if (!event) {
    return { success: false, message: 'Event not found.', status: 'error' };
  }
  if (event['Status'] !== CONFIG.EVENT_STATUS.ACTIVE) {
    return { success: false, message: 'This event is not currently active.', status: 'error' };
  }

  // Verify student exists and is active
  var student = getStudentByNo(studentNo);
  if (!student) {
    return { success: false, message: 'Student not found in records.', status: 'error' };
  }

  fullName = student["First Name"] +
           (student["Middle Name"] ? " " + student["Middle Name"] : "") +
           " " +
           student["Last Name"];
           
  if (student['Status'] !== CONFIG.STUDENT_STATUS.ACTIVE) {
    return { success: false, message: 'Student is not currently active/enrolled.', status: 'error' };
  }

var regOpen = parseEventTime(event['Date'], event['Reg Open']);
var regClose = parseEventTime(event['Date'], event['Reg Close']);
var timeoutStart = parseEventTime(event['Date'], event['Timeout Start']);
var timeoutEnd = parseEventTime(event['Date'], event['Timeout Deadline']);

Logger.log({
  now: now,
  date: event['Date'],
  regOpen: event['Reg Open'],
  regClose: event['Reg Close'],
  timeoutStart: event['Timeout Start'],
  timeoutEnd: event['Timeout Deadline'],
  parsedRegOpen: regOpen,
  parsedRegClose: regClose,
  parsedTimeoutStart: timeoutStart,
  parsedTimeoutEnd: timeoutEnd
});

// Registration has not started yet
if (regOpen && now < regOpen) {
  return {
    success: false,
    status: "Registration Not Open",
    message: "Registration has not started yet."
  };
}

if (timeoutEnd && now >= timeoutEnd) {
  return {
    success: false,
    status: "Event Over",
    message: "This event has already ended. Attendance is closed."
  };
}

// Check existing attendance record
var existing = findAttendance(studentNo, eventId);

// -----------------------------
// TIME OUT WINDOW
// -----------------------------
if (
    timeoutStart &&
    timeoutEnd &&
    now >= timeoutStart &&
    now < timeoutEnd
) {

  if (!existing) {
    return {
      success: false,
      status: "Registration Closed",
      message: "Time In is already closed."
    };
  }

  if (existing.scanCount >= 2) {
    return {
      success: false,
      message: "Already fully scanned.",
      status: CONFIG.STATUS.DUPLICATE,
      student: fullName,
      eventName: event["Event Name"]
    };
  }

  var timeOutStr = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

  var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);

  sheet.getRange(existing.row, ATT_COLS.TIME_OUT + 1, 1, 3)
       .setValues([[
         timeOutStr,
         CONFIG.STATUS.TIME_OUT,
         2
       ]]);

       rebuildAttendanceReport();
       rebuildAttendanceDetails();
       rebuildStudentAttendanceHistory();
       rebuildAnalyticsDashboard();

  return {
    success: true,
    message: "Time Out recorded.",
    status: CONFIG.STATUS.TIME_OUT,
    student: fullName,
    time: timeOutStr,
    eventName: event["Event Name"]
  };
}
// Outside registration period
if (existing) {
  return {
    success: false,
    status: CONFIG.STATUS.DUPLICATE,
    message: "Already scanned. Please wait for the Time Out period.",
    student: fullName,
    eventName: event["Event Name"]
  };
}

var attendanceStatus;

// Registration still open
if (now >= regOpen && now <= regClose) {

    attendanceStatus = CONFIG.STATUS.TIME_IN;

}
else if (now > regClose && now < timeoutStart) {

    attendanceStatus = CONFIG.STATUS.LATE;

}
else {

    return {
        success: false,
        status: "Registration Closed",
        message: "Time In is no longer available."
    };

}

var timeInStr = Utilities.formatDate(
  now,
  Session.getScriptTimeZone(),
  'yyyy-MM-dd HH:mm:ss'
);

var logId = generateLogId();

var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);
var row = sheet.getLastRow() + 1;

sheet.getRange(row, 1, 1, 9).setValues([[
  logId,
  eventId,
  event['Event Name'],
  studentNo,
  fullName,
  timeInStr,
  '',
  attendanceStatus,
  1
]]);

rebuildAttendanceReport();
rebuildAttendanceDetails();
rebuildStudentAttendanceHistory();
rebuildAnalyticsDashboard();

return {
  success: true,
  message: attendanceStatus === CONFIG.STATUS.LATE
      ? 'Late entry recorded.'
      : 'Time In recorded.',
  status: attendanceStatus,
  student: fullName,
  time: timeInStr,
  eventName: event['Event Name']
};
}


// Get existing attendance record for student+event
function findAttendance(studentNo, eventId) {

  var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

  for (var i = 0; i < data.length; i++) {

    if (
      String(data[i][ATT_COLS.STUDENT_NO]) === String(studentNo) &&
      String(data[i][ATT_COLS.EVENT_ID]) === String(eventId)
    ) {

      return {
        row: i + 2,
        scanCount: parseInt(data[i][ATT_COLS.SCAN_COUNT]) || 1
      };

    }
  }

  return null;
}

// Parse event date + time string into a Date object
// Handles both plain "HH:mm" strings and Google Sheets 1899 date serials
function parseEventTime(dateVal, timeVal) {

  if (!dateVal || !timeVal) return null;

  var eventDate = new Date(dateVal);
  if (isNaN(eventDate)) return null;

  var hours = 0;
  var minutes = 0;

  if (timeVal instanceof Date) {

    hours = timeVal.getHours();
    minutes = timeVal.getMinutes();

  } else {

    var match = String(timeVal).match(/(\d{1,2}):(\d{2})/);

    if (!match) return null;

    hours = Number(match[1]);
    minutes = Number(match[2]);

    if (/PM/i.test(timeVal) && hours < 12) hours += 12;
    if (/AM/i.test(timeVal) && hours == 12) hours = 0;

  }

  return new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    hours,
    minutes,
    0,
    0
  );
}
// Format a Google Sheets time value to HH:MM string
function formatSheetTime(timeVal) {
  if (!timeVal) return '—';
  var d = new Date(timeVal);
  if (!isNaN(d) && d.getFullYear() === 1899) {
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
  }
  return String(timeVal);
}

// Format a Google Sheets date value to readable string
function formatSheetDate(dateVal) {
  if (!dateVal) return '—';
  var d = new Date(dateVal);
  if (!isNaN(d)) {
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(dateVal);
}

// Get attendance records for a specific event (for live feed)
function getEventAttendance(eventId) {
  var records = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  return records.filter(function(r) {
    return String(r['Event ID']) === String(eventId);
  });
}

// Auto mark No Timeout — run via time-based trigger or manual call
function autoMarkNoTimeout() {
  var now    = new Date();
  var events = getAllEvents();

  events.forEach(function(event) {
    if (event['Status'] !== CONFIG.EVENT_STATUS.ACTIVE &&
        event['Status'] !== CONFIG.EVENT_STATUS.INACTIVE) return;

    var deadline = parseEventTime(event['Date'], event['Timeout Deadline']);
    if (!deadline || now < deadline) return;

    // Mark all records with no timeout for this event
    var sheet = getSheet(CONFIG.SHEETS.ATTENDANCE);
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      var eventIdCell  = String(data[i][ATT_COLS.EVENT_ID]);
      var statusCell   = String(data[i][ATT_COLS.STATUS]);
      var timeOutCell  = String(data[i][ATT_COLS.TIME_OUT]);

      if (eventIdCell === String(event['Event ID']) &&
          (statusCell === CONFIG.STATUS.TIME_IN || statusCell === CONFIG.STATUS.LATE) &&
          timeOutCell === '') {
        sheet.getRange(i + 1, ATT_COLS.STATUS + 1).setValue(CONFIG.STATUS.NO_TIMEOUT);
      }
    }
  });

  rebuildAttendanceReport();
  rebuildAttendanceDetails();
  rebuildStudentAttendanceHistory();
  rebuildAnalyticsDashboard();

  return { success: true, message: 'No-timeout check complete.' };
}

// Dashboard stats
function getDashboardStats() {
  var studentStats = getStudentStats();
  var eventStats   = getEventStats();
  var activeEvent  = getActiveEvent();
  var todayScans   = 0;

  if (activeEvent) {
    var records = getEventAttendance(activeEvent['Event ID']);
    todayScans  = records.length;
  }

  return {
    totalStudents:  studentStats.total,
    activeStudents: studentStats.active,
    totalEvents:    eventStats.total,
    activeEvents:   eventStats.active,
    todayScans:     todayScans,
    activeEvent:    activeEvent ? activeEvent['Event Name'] : null,
    activeEventId:  activeEvent ? activeEvent['Event ID']   : null
  };
}



function rebuildAttendanceReport() {

  var attendance = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  var students   = getAllRows(CONFIG.SHEETS.STUDENTS);

  

  var reportSheet = getSheet("Attendance Report");

 reportSheet.clearContents();

  reportSheet.appendRow([
    "Event",
    "Date",
    "Year Level",
    "Block",
    "Total Students",
    "Time In",
    "Late",
    "Time Out",
    "No Timeout",
    "Attendance %"
  ]);

  var totals = {};

  // Build lookup of total students per Year+Block
  var studentTotals = {};

  students.forEach(function(s){

    if (s.Status !== CONFIG.STUDENT_STATUS.ACTIVE) return;

    var key = s["Year Level"] + "|" +s["Block"] ;

    if(!studentTotals[key]) studentTotals[key]=0;

    studentTotals[key]++;

  });
  var studentMap = {};

students.forEach(function(s){

    studentMap[String(s["Student No"])] = s;

});

var events = getAllRows(CONFIG.SHEETS.EVENTS);

var eventMap = {};

events.forEach(function(e){
    eventMap[String(e["Event ID"])] = e;
});


  attendance.forEach(function(a){


var eventInfo = eventMap[String(a["Event ID"])] || {};

var student = studentMap[String(a["Student No"])];

    if(!student) return;

    var key =
      a["Event Name"] + "|" +
      a["Event ID"] + "|" +
      student["Year Level"] + "|" +
      student["Block"];

    if(!totals[key]){

totals[key] = {
  event: a["Event Name"],
  date: eventInfo["Date"]
    ? Utilities.formatDate(
        new Date(eventInfo["Date"]),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd"
      )
    : "",
  year: student["Year Level"],
  block: student["Block"],
  total: studentTotals[
    student["Year Level"] + "|" + student["Block"]
  ] || 0,
  timeIn: 0,
  late: 0,
  timeout: 0,
  noTimeout: 0
};

    }

if (a["Time Out"]) {

    totals[key].timeout++;

}
else if (a["Status"] == CONFIG.STATUS.LATE) {

    totals[key].late++;

}
else if (a["Status"] == CONFIG.STATUS.TIME_IN) {

    totals[key].timeIn++;

}
else if (a["Status"] == CONFIG.STATUS.NO_TIMEOUT) {

    totals[key].noTimeout++;

}
  });

  var keys = Object.keys(totals).sort(function(a, b) {

    var x = totals[a];
    var y = totals[b];

    if (x.event != y.event)
        return x.event.localeCompare(y.event);

    if (x.year != y.year)
        return x.year - y.year;

    return x.block.localeCompare(y.block);

});

keys.forEach(function(k) {

    var r = totals[k];

});

  Object.keys(totals).forEach(function(k){

    var r=totals[k];

var present = r.timeIn + r.late + r.noTimeout;

var percent = r.total
    ? ((present / r.total) * 100).toFixed(1) + "%"
    : "0%";

    reportSheet.appendRow([
      r.event,
      r.date,
      r.year,
      r.block,
      r.total,
      r.timeIn,
      r.late,
      r.timeout,
      r.noTimeout,
      percent
    ]);

  });

}

function rebuildAttendanceDetails() {

  var attendance = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  var students = getAllRows(CONFIG.SHEETS.STUDENTS);
  var events = getAllRows(CONFIG.SHEETS.EVENTS);

  var detailSheet = getSheet("Attendance Details");

  detailSheet.clearContents();

  detailSheet.appendRow([
    "Event",
    "Date",
    "Student No",
    "Full Name",
    "Year Level",
    "Block",
    "Status",
    "Time In",
    "Time Out"
  ]);

  // Student lookup
  var studentMap = {};

  students.forEach(function(s) {
    studentMap[String(s["Student No"])] = s;
  });

  // Event lookup
  var eventMap = {};

  events.forEach(function(e) {
    eventMap[String(e["Event ID"])] = e;
  });

  attendance.forEach(function(a) {

    var student = studentMap[String(a["Student No"])] || {};
    var event = eventMap[String(a["Event ID"])] || {};

    var eventDate = "";

    if (event["Date"]) {
      eventDate = Utilities.formatDate(
        new Date(event["Date"]),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd"
      );
    }

    detailSheet.appendRow([
      a["Event Name"],
      eventDate,
      a["Student No"],
      a["Full Name"],
      student["Year Level"] || "",
      student["Block"] || "",
      a["Status"],
      a["Time In"],
      a["Time Out"]
    ]);

  });

  detailSheet.getRange(1,1,1,9).setFontWeight("bold");
  detailSheet.setFrozenRows(1);

// Remove existing filter if present
if (detailSheet.getFilter()) {
    detailSheet.getFilter().remove();
}

if (detailSheet.getLastRow() > 1) {
    detailSheet
        .getRange(1, 1, detailSheet.getLastRow(), 9)
        .createFilter();
}

  detailSheet.autoResizeColumns(1,9);
}

function getAttendanceReport() {

  var attendance = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  var students = getAllRows(CONFIG.SHEETS.STUDENTS);

  var studentMap = {};

  students.forEach(function(s){

    studentMap[String(s["Student No"])] = s;

  });

  return attendance.map(function(a){

    var student = studentMap[String(a["Student No"])] || {};

    return {

      "Student No": a["Student No"],
      "Full Name": a["Full Name"],
      "Year Level": student["Year Level"] || "",
      "Block": student["Block"] || "",
      "Event Name": a["Event Name"],
      "Attendance Status": a["Status"],
      "Time In": a["Time In"],
      "Time Out": a["Time Out"]

    };

  });

}

function rebuildStudentAttendanceHistory() {

  var report = getSheet("Student Attendance History");
  report.clearContents();

  report.appendRow([
    "Student No",
    "Student Name",
    "Year Level",
    "Block",
    "Event",
    "Date",
    "Status",
    "Time In",
    "Time Out"
  ]);

  var attendance = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  var students = getAllRows(CONFIG.SHEETS.STUDENTS);
  var events = getAllRows(CONFIG.SHEETS.EVENTS);

  var studentMap = {};
  students.forEach(function(s){
    studentMap[String(s["Student No"])] = s;
  });

  var eventMap = {};
  events.forEach(function(e){
    eventMap[String(e["Event ID"])] = e;
  });

  attendance.forEach(function(a){

    var student = studentMap[String(a["Student No"])] || {};
    var event = eventMap[String(a["Event ID"])] || {};

    report.appendRow([
      a["Student No"],
      a["Full Name"],
      student["Year Level"] || "",
      student["Block"] || "",
      a["Event Name"],
      event["Date"] || "",
      a["Status"],
      a["Time In"],
      a["Time Out"]
    ]);

  });

}
