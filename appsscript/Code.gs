// ============================================================
// Code.gs — Main Web App entry point (doGet / doPost router)
// ============================================================

function doGet(e) {
  var params = e.parameter;
  var action = params.action || '';

  // Handle Quick Scan (QR code scan without browser redirect)
  if (action === 'quickScan') {
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
    
    // Return auto-closing HTML page
    var html = '<html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:' + (result.success ? '#dcfce7' : '#fee2e2') + '}.container{text-align:center;padding:20px}.icon{font-size:3rem;margin-bottom:10px}.status{font-size:1.3rem;font-weight:bold;margin-bottom:5px}.name{font-size:1rem;margin-bottom:10px}.meta{font-size:.9rem;color:#666;margin-bottom:20px}.auto-close{font-size:.9rem;color:#666}</style></head><body><div class="container"><div class="icon">' + (result.success ? '✅' : '⚠️') + '</div><div class="status">' + (result.success ? 'Scanned!' : 'Error') + '</div><div class="name">' + escapeHtml(result.student || '') + '</div><div class="meta">' + escapeHtml(result.message || result.time || '') + '</div><div class="auto-close">Closing in 2 seconds...</div></div><script>setTimeout(function(){window.close()},2000);</script></body></html>';
    
    return HtmlService.createHtmlOutput(html);
  }

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

// ── HTML Escape Helper ──────────────────────────────────────
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
