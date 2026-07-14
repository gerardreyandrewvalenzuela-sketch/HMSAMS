// ============================================================
// events.gs — Event CRUD operations
// ============================================================

// Column indices for Events sheet (0-based)
var EVENT_COLS = {
  EVENT_ID:         0,
  EVENT_NAME:       1,
  DATE:             2,
  REG_OPEN:         3,
  REG_CLOSE:        4,
  TIMEOUT_START:    5,
  TIMEOUT_DEADLINE: 6,
  STATUS:           7
};

function generateEventId() {
  return 'EVT-' + new Date().getTime();
}

function getAllEvents() {
  return getAllRows(CONFIG.SHEETS.EVENTS);
}

function getEventById(eventId) {
  var events = getAllEvents();
  return events.find(function(e) {
    return String(e['Event ID']) === String(eventId);
  }) || null;
}

function getActiveEvent() {
  var events = getAllEvents();
  return events.find(function(e) {
    return e['Status'] === CONFIG.EVENT_STATUS.ACTIVE;
  }) || null;
}

function addEvent(data) {
  Logger.log(JSON.stringify(data));

  var eventId = generateEventId();

  appendRow(CONFIG.SHEETS.EVENTS, [
    eventId,
    data.eventName,
    data.date,
    data.regOpen,
    data.regClose,
    data.timeoutStart,
    data.timeoutDeadline,
    CONFIG.EVENT_STATUS.INACTIVE
  ]);

  return {
    success: true,
    eventId: eventId
  };
}

function updateEvent(eventId, data) {
  var rowIndex = findRowIndex(CONFIG.SHEETS.EVENTS, EVENT_COLS.EVENT_ID, eventId);
  if (rowIndex === -1) {
    return { success: false, message: 'Event not found.' };
  }
updateRow(CONFIG.SHEETS.EVENTS, rowIndex, [
  eventId,
  data.eventName,
  data.date,
  data.regOpen,
  data.regClose,
  data.timeoutStart,
  data.timeoutDeadline,
  data.status
]);
  return { success: true, message: 'Event updated.' };
}

function setEventStatus(eventId, status) {
  // If activating, deactivate all others first
  if (status === CONFIG.EVENT_STATUS.ACTIVE) {
    var allEvents = getAllEvents();
    allEvents.forEach(function(e) {
      if (e['Status'] === CONFIG.EVENT_STATUS.ACTIVE && e['Event ID'] !== eventId) {
        var ri = findRowIndex(CONFIG.SHEETS.EVENTS, EVENT_COLS.EVENT_ID, e['Event ID']);
        if (ri !== -1) {
          updateCell(CONFIG.SHEETS.EVENTS, ri, EVENT_COLS.STATUS + 1, CONFIG.EVENT_STATUS.INACTIVE);
        }
      }
    });
  }
  var rowIndex = findRowIndex(CONFIG.SHEETS.EVENTS, EVENT_COLS.EVENT_ID, eventId);
  if (rowIndex === -1) {
    return { success: false, message: 'Event not found.' };
  }
  updateCell(CONFIG.SHEETS.EVENTS, rowIndex, EVENT_COLS.STATUS + 1, status);
  return { success: true, message: 'Event status updated.' };
}

function deleteEvent(eventId) {
  var rowIndex = findRowIndex(CONFIG.SHEETS.EVENTS, EVENT_COLS.EVENT_ID, eventId);
  if (rowIndex === -1) {
    return { success: false, message: 'Event not found.' };
  }
  deleteRow(CONFIG.SHEETS.EVENTS, rowIndex);
  return { success: true, message: 'Event deleted.' };
}

function getEventStats() {
  var events = getAllEvents();
  var active  = events.filter(function(e) { return e['Status'] === CONFIG.EVENT_STATUS.ACTIVE; });
  var archived = events.filter(function(e) { return e['Status'] === CONFIG.EVENT_STATUS.ARCHIVED; });
  return {
    total:    events.length,
    active:   active.length,
    archived: archived.length
  };
}
