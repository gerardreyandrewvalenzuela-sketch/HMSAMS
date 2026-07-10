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

  // PIN-protected write actions sent as GET
  var writeActions = [
    'addStudent','updateStudent','removeStudent','setStudentStatus',
    'addEvent','updateEvent','setEventStatus','deleteEvent',
    'processScan','autoMarkNoTimeout'
  ];

  if (writeActions.indexOf(action) !== -1) {
    // Verify PIN
    if (params.pin !== CONFIG.PIN) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Invalid PIN.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try {
      // Rebuild body from params, parse JSON fields
      var body = {};
      Object.keys(params).forEach(function(k) {
        try { body[k] = JSON.parse(params[k]); }
        catch(ex) { body[k] = params[k]; }
      });
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

  // Read-only GET actions
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
      return addStudent({
        studentNo:  body.studentNo  || body['data.studentNo'],
        lastName:   body.lastName   || body['data.lastName'],
        firstName:  body.firstName  || body['data.firstName'],
        middleName: body.middleName || body['data.middleName'] || '',
        yearLevel:  body.yearLevel  || body['data.yearLevel'],
        block:      body.block      || body['data.block'],
        status:     body.status     || body['data.status'] || 'Active'
      });

    case 'updateStudent':
      return updateStudent(body.studentNo, {
        studentNo:  body.studentNo,
        lastName:   body.lastName,
        firstName:  body.firstName,
        middleName: body.middleName || '',
        yearLevel:  body.yearLevel,
        block:      body.block,
        status:     body.status
      });

    case 'removeStudent':
      return removeStudent(body.studentNo);

    case 'setStudentStatus':
      return setStudentStatus(body.studentNo, body.status);

    // Events
    case 'addEvent':
      return addEvent({
        eventName:       body.eventName,
        date:            body.date,
        regOpen:         body.regOpen,
        regClose:        body.regClose,
        timeoutDeadline: body.timeoutDeadline,
        status:          body.status || 'Inactive'
      });

    case 'updateEvent':
      return updateEvent(body.eventId, {
        eventName:       body.eventName,
        date:            body.date,
        regOpen:         body.regOpen,
        regClose:        body.regClose,
        timeoutDeadline: body.timeoutDeadline,
        status:          body.status
      });

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
