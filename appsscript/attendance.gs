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
  if (student['Status'] !== CONFIG.STUDENT_STATUS.ACTIVE) {
    return { success: false, message: 'Student is not currently active/enrolled.', status: 'error' };
  }

  // Check existing attendance record for this student + event
  var existing = getAttendanceRecord(studentNo, eventId);

  if (existing) {
    var scanCount = parseInt(existing['Scan Count']) || 1;

    // 3rd scan or more — duplicate
    if (scanCount >= 2) {
      return {
        success:   false,
        message:   'Already fully scanned. No further action needed.',
        status:    CONFIG.STATUS.DUPLICATE,
        student:   fullName,
        eventName: event['Event Name']
      };
    }

    // 2nd scan — Time Out
    var rowIndex = findAttendanceRowIndex(studentNo, eventId);
    var timeOutStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    updateCell(CONFIG.SHEETS.ATTENDANCE, rowIndex, ATT_COLS.TIME_OUT   + 1, timeOutStr);
    updateCell(CONFIG.SHEETS.ATTENDANCE, rowIndex, ATT_COLS.STATUS     + 1, CONFIG.STATUS.TIME_OUT);
    updateCell(CONFIG.SHEETS.ATTENDANCE, rowIndex, ATT_COLS.SCAN_COUNT + 1, 2);

    return {
      success:   true,
      message:   'Time Out recorded.',
      status:    CONFIG.STATUS.TIME_OUT,
      student:   fullName,
      time:      timeOutStr,
      eventName: event['Event Name']
    };
  }

  // 1st scan — determine Time In or Late
  var regClose = parseEventTime(event['Date'], event['Reg Close']);
  var attendanceStatus = (regClose && now > regClose)
    ? CONFIG.STATUS.LATE
    : CONFIG.STATUS.TIME_IN;

  var timeInStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var logId     = generateLogId();

  appendRow(CONFIG.SHEETS.ATTENDANCE, [
    logId,
    eventId,
    event['Event Name'],
    studentNo,
    fullName,
    timeInStr,
    '',
    attendanceStatus,
    1
  ]);

  return {
    success:   true,
    message:   attendanceStatus === CONFIG.STATUS.LATE ? 'Late entry recorded.' : 'Time In recorded.',
    status:    attendanceStatus,
    student:   fullName,
    time:      timeInStr,
    eventName: event['Event Name']
  };
}

// Get existing attendance record for student+event
function getAttendanceRecord(studentNo, eventId) {
  var records = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  return records.find(function(r) {
    return String(r['Student No']) === String(studentNo) &&
           String(r['Event ID'])   === String(eventId);
  }) || null;
}

// Find the row index of an attendance record
function findAttendanceRowIndex(studentNo, eventId) {
  var sheet   = getSheet(CONFIG.SHEETS.ATTENDANCE);
  var data    = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][ATT_COLS.STUDENT_NO]) === String(studentNo) &&
        String(data[i][ATT_COLS.EVENT_ID])   === String(eventId)) {
      return i + 1;
    }
  }
  return -1;
}

// Parse event date + time string into a Date object
// Handles both plain "HH:mm" strings and Google Sheets 1899 date serials
function parseEventTime(dateStr, timeStr) {
  try {
    // If timeStr is a Date object (Google Sheets stores time-only as 1899 date)
    var timeObj = new Date(timeStr);
    var hours, minutes;

    if (!isNaN(timeObj) && timeObj.getFullYear() === 1899) {
      hours   = timeObj.getUTCHours();
      minutes = timeObj.getUTCMinutes();
    } else if (typeof timeStr === 'string' && timeStr.indexOf(':') !== -1) {
      var parts = timeStr.split(':');
      hours   = parseInt(parts[0]);
      minutes = parseInt(parts[1]);
    } else {
      return null;
    }

    // Parse the date
    var dateObj = new Date(dateStr);
    if (isNaN(dateObj)) return null;

    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj;
  } catch(e) {
    return null;
  }
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
