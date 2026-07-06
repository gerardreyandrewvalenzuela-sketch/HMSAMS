// ============================================================
// Code.gs — Main Web App entry point (doGet / doPost router)
// ============================================================

function doGet(e) {
  var params = e.parameter;
  var action = params.action || '';

  // Handle QR scan redirect (student scans their QR code)
  if (action === 'scan') {
    var studentNo = params.id   || '';
    var fullName  = params.name || '';
    var eventId   = params.event || '';

    // If no event specified, use the active event
    if (!eventId) {
      var activeEvent = getActiveEvent();
      if (activeEvent) {
        eventId = activeEvent['Event ID'];
      }
    }

    var result = processScan(studentNo, fullName, eventId);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // General GET actions
  try {
    var result = routeGet(action, params);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action || '';

    // PIN verification for write operations
    if (body.pin !== CONFIG.PIN) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Invalid PIN.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result = routePost(action, body);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET Router ──────────────────────────────────────────────
function routeGet(action, params) {
  switch(action) {

    // Students
    case 'getStudents':
      return { success: true, data: getAllStudents() };

    // Events
    case 'getEvents':
      return { success: true, data: getAllEvents() };

    case 'getActiveEvent':
      return { success: true, data: getActiveEvent() };

    // Attendance
    case 'getEventAttendance':
      return { success: true, data: getEventAttendance(params.eventId) };

    // Dashboard
    case 'getDashboardStats':
      return { success: true, data: getDashboardStats() };

    // Setup
    case 'init':
      return initializeSheets();

    // PIN verification (GET-based, no sensitive write)
    case 'verifyPin':
      return { success: params.pin === CONFIG.PIN };

    default:
      return { success: false, message: 'Unknown action: ' + action };
  }
}

// ── POST Router ─────────────────────────────────────────────
function routePost(action, body) {
  switch(action) {

    // Students
    case 'addStudent':
      return addStudent(body.data);

    case 'updateStudent':
      return updateStudent(body.studentNo, body.data);

    case 'removeStudent':
      return removeStudent(body.studentNo);

    case 'setStudentStatus':
      return setStudentStatus(body.studentNo, body.status);

    // Events
    case 'addEvent':
      return addEvent(body.data);

    case 'updateEvent':
      return updateEvent(body.eventId, body.data);

    case 'setEventStatus':
      return setEventStatus(body.eventId, body.status);

    case 'deleteEvent':
      return deleteEvent(body.eventId);

    // Attendance
    case 'processScan':
      return processScan(body.studentNo, body.fullName, body.eventId);

    case 'autoMarkNoTimeout':
      return autoMarkNoTimeout();

    default:
      return { success: false, message: 'Unknown action: ' + action };
  }
}
