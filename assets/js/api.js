// ============================================================
// api.js — All communication with the Apps Script Web App
// ============================================================

// TODO: Replace this URL after you deploy your Apps Script as a Web App
var API_URL = 'https://script.google.com/macros/s/AKfycby_HM635vwlHG_WKbh8d-KShFzgNP3PhfmwshgoiR9v/dev';

// ── Stored PIN (session-level) ───────────────────────────────
var _pin = sessionStorage.getItem('hmsams_pin') || '';

function setPin(pin) {
  _pin = pin;
  sessionStorage.setItem('hmsams_pin', pin);
}

function clearPin() {
  _pin = '';
  sessionStorage.removeItem('hmsams_pin');
}

// ── Core fetch helpers ───────────────────────────────────────

/**
 * GET request — no PIN required, read-only
 * @param {string} action
 * @param {Object} params - additional query params
 */
async function apiGet(action, params) {
  var url = new URL(API_URL);
  url.searchParams.set('action', action);
  if (params) {
    Object.keys(params).forEach(function(k) {
      url.searchParams.set(k, params[k]);
    });
  }
  var res = await fetch(url.toString());
  return res.json();
}

/**
 * POST request — PIN required for write operations
 * @param {string} action
 * @param {Object} body
 */
async function apiPost(action, body) {
  var payload = Object.assign({ action: action, pin: _pin }, body);
  var res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(payload)
  });
  return res.json();
}

// ── PIN ──────────────────────────────────────────────────────
async function verifyPin(pin) {
  var res = await apiGet('verifyPin', { pin: pin });
  return res.success === true;
}

// ── Students ─────────────────────────────────────────────────
async function getStudents() {
  return apiGet('getStudents');
}
async function addStudent(data) {
  return apiPost('addStudent', { data: data });
}
async function updateStudent(studentNo, data) {
  return apiPost('updateStudent', { studentNo: studentNo, data: data });
}
async function removeStudent(studentNo) {
  return apiPost('removeStudent', { studentNo: studentNo });
}
async function setStudentStatus(studentNo, status) {
  return apiPost('setStudentStatus', { studentNo: studentNo, status: status });
}

// ── Events ───────────────────────────────────────────────────
async function getEvents() {
  return apiGet('getEvents');
}
async function getActiveEvent() {
  return apiGet('getActiveEvent');
}
async function addEvent(data) {
  return apiPost('addEvent', { data: data });
}
async function updateEvent(eventId, data) {
  return apiPost('updateEvent', { eventId: eventId, data: data });
}
async function setEventStatus(eventId, status) {
  return apiPost('setEventStatus', { eventId: eventId, status: status });
}
async function deleteEvent(eventId) {
  return apiPost('deleteEvent', { eventId: eventId });
}

// ── Attendance ───────────────────────────────────────────────
async function getEventAttendance(eventId) {
  return apiGet('getEventAttendance', { eventId: eventId });
}
async function processScan(studentNo, fullName, eventId) {
  return apiPost('processScan', {
    studentNo: studentNo,
    fullName:  fullName,
    eventId:   eventId
  });
}

// ── Dashboard ────────────────────────────────────────────────
async function getDashboardStats() {
  return apiGet('getDashboardStats');
}

// ── Init ─────────────────────────────────────────────────────
async function initSheets() {
  return apiGet('init');
}

// ── PIN Gate helper (used by all protected pages) ────────────
// Call this at the top of any page that needs PIN
function setupPinGate(onUnlocked) {
  var overlay   = document.getElementById('pin-overlay');
  var pinInput  = document.getElementById('pin-input');
  var pinSubmit = document.getElementById('pin-submit');
  var pinError  = document.getElementById('pin-error');

  // If already unlocked this session, skip overlay
  if (_pin) {
    verifyPin(_pin).then(function(valid) {
      if (valid) {
        overlay.style.display = 'none';
        onUnlocked();
      } else {
        clearPin();
      }
    });
    return;
  }

  async function attemptUnlock() {
    var entered = pinInput.value.trim();
    if (!entered) { pinError.textContent = 'Please enter the PIN.'; return; }

    pinSubmit.disabled = true;
    pinError.textContent = '';

    var valid = await verifyPin(entered);
    if (valid) {
      setPin(entered);
      overlay.style.display = 'none';
      onUnlocked();
    } else {
      pinError.textContent = 'Incorrect PIN. Try again.';
      pinInput.value = '';
      pinInput.focus();
    }
    pinSubmit.disabled = false;
  }

  pinSubmit.addEventListener('click', attemptUnlock);
  pinInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') attemptUnlock();
  });
}

// ── Utility: show toast notification ────────────────────────
function showToast(message, type) {
  var existing = document.getElementById('hms-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.id = 'hms-toast';
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:' + (type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#16a34a'),
    'color:#fff',
    'padding:10px 20px',
    'border-radius:8px',
    'font-size:.9rem',
    'font-weight:600',
    'z-index:9999',
    'box-shadow:0 4px 12px rgba(0,0,0,.2)',
    'max-width:90vw',
    'text-align:center',
    'animation:slideIn .25s ease'
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3500);
}

// ── Utility: format time ─────────────────────────────────────
function formatTime(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Utility: status badge HTML ───────────────────────────────
function statusBadge(status) {
  var map = {
    'Time In':      'timein',
    'Late':         'late',
    'Time Out':     'timeout',
    'No Timeout':   'notimeout',
    'Duplicate Scan':'duplicate',
    'Active':       'active',
    'Inactive':     'inactive',
    'Archived':     'archived'
  };
  var cls = map[status] || 'inactive';
  return '<span class="badge badge--' + cls + '">' + (status || '—') + '</span>';
}
