// ============================================================
// scanner.js — Scan result page + live attendance feed
// ============================================================

var _activeEvent  = null;
var _feedTimer    = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupPinGate(onPinUnlocked);
});

async function onPinUnlocked() {
  document.getElementById('scanner-content').style.display = 'block';

  // Check for scan params in URL (student scanned their QR)
  var params     = new URLSearchParams(window.location.search);
  var studentNo  = params.get('id')    || '';
  var studentName= params.get('name')  || '';
  var eventParam = params.get('event') || '';

  // Load active event info
  await loadActiveEvent();

  // If QR scan triggered this page load, process it
  if (studentNo) {
    await handleQrScan(studentNo, studentName, eventParam);
    // Clean URL so refreshing doesn't re-submit
    history.replaceState({}, '', 'scan.html');
  }

  // Load live feed
  loadLiveFeed();
  startFeedRefresh();

  // Manual entry button
  document.getElementById('manual-submit').addEventListener('click', handleManualEntry);
  document.getElementById('manual-student-no').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleManualEntry();
  });

  // Refresh button
  document.getElementById('refresh-feed').addEventListener('click', function() {
    loadLiveFeed();
  });
}

// ── Load Active Event ────────────────────────────────────────
async function loadActiveEvent() {
  try {
    var res = await getActiveEvent();
    _activeEvent = res.data || null;

    var nameEl    = document.getElementById('current-event-name');
    var badgeEl   = document.getElementById('event-status-badge');
    var warnEl    = document.getElementById('no-event-warning');
    var instrEl   = document.getElementById('scanner-instructions');

    if (_activeEvent) {
      nameEl.textContent   = _activeEvent['Event Name'];
      badgeEl.style.display = 'inline-block';
      warnEl.style.display  = 'none';
      instrEl.style.display = 'block';
    } else {
      nameEl.textContent    = 'No active event';
      badgeEl.style.display = 'none';
      warnEl.style.display  = 'flex';
      instrEl.style.display = 'none';
    }
  } catch(err) {
    console.error('Load event error:', err);
  }
}

// ── Process Scan (called when QR URL is opened) ──────────────
async function handleQrScan(studentNo, studentName, eventId) {
  if (!_activeEvent && !eventId) {
    showScanResult({
      success: false,
      status:  'error',
      message: 'No active event. Please activate an event first.'
    });
    return;
  }

  var eid = eventId || (_activeEvent ? _activeEvent['Event ID'] : '');

  try {
    var res = await processScan(studentNo, studentName, eid);
    showScanResult(res);
    if (res.success) loadLiveFeed();
  } catch(err) {
    showScanResult({ success: false, status: 'error', message: 'Connection error. Try again.' });
  }
}

// ── Manual Entry ─────────────────────────────────────────────
async function handleManualEntry() {
  var studentNo   = document.getElementById('manual-student-no').value.trim();
  var studentName = document.getElementById('manual-student-name').value.trim();

  if (!studentNo || !studentName) {
    showToast('Please enter both Student No. and Full Name.', 'error');
    return;
  }

  if (!_activeEvent) {
    showToast('No active event.', 'error');
    return;
  }

  var btn = document.getElementById('manual-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recording...';

  try {
    var res = await processScan(studentNo, studentName, _activeEvent['Event ID']);
    showScanResult(res);
    if (res.success) {
      document.getElementById('manual-student-no').value   = '';
      document.getElementById('manual-student-name').value = '';
      loadLiveFeed();
    }
  } catch(err) {
    showToast('Connection error. Try again.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> Record Attendance';
}

// ── Scan Result Banner ───────────────────────────────────────
function showScanResult(res) {
  var el      = document.getElementById('scan-result');
  var iconEl  = document.getElementById('scan-result-icon');
  var statusEl= document.getElementById('scan-result-status');
  var nameEl  = document.getElementById('scan-result-name');
  var metaEl  = document.getElementById('scan-result-meta');

  // Clear previous classes
  el.className = 'scan-result';

  var icon, statusText, cls;

  if (!res.success) {
    icon       = '⚠️';
    statusText = res.status === 'Duplicate Scan' ? 'Already Scanned' : 'Error';
    cls        = res.status === 'Duplicate Scan' ? 'duplicate' : 'error';
  } else {
    switch(res.status) {
      case 'Time In':
        icon = '✅'; statusText = 'TIME IN';  cls = 'timein';  break;
      case 'Late':
        icon = '🕐'; statusText = 'LATE';     cls = 'late';    break;
      case 'Time Out':
        icon = '👋'; statusText = 'TIME OUT'; cls = 'timeout'; break;
      default:
        icon = 'ℹ️'; statusText = res.status; cls = 'timein';
    }
  }

  el.classList.add('scan-result--' + cls);
  iconEl.textContent   = icon;
  statusEl.textContent = statusText;
  nameEl.textContent   = res.student || '';
  metaEl.textContent   = res.time
    ? formatDateTime(res.time) + ' — ' + (res.eventName || '')
    : res.message || '';

  el.style.display = 'block';

  // Auto-hide after 8 seconds
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() {
    el.style.display = 'none';
  }, 8000);
}

// ── Live Feed ────────────────────────────────────────────────
async function loadLiveFeed() {
  if (!_activeEvent) return;

  try {
    var res = await getEventAttendance(_activeEvent['Event ID']);
    if (!res.success) return;
    renderFeed(res.data || []);
  } catch(err) {
    console.error('Feed error:', err);
  }
}

function renderFeed(records) {
  var tbody = document.getElementById('attendance-tbody');

  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No records yet.</td></tr>';
    return;
  }

  // Sort by most recent first (Time In column)
  records.sort(function(a, b) {
    return new Date(b['Time In']) - new Date(a['Time In']);
  });

  tbody.innerHTML = records.map(function(r) {
    return '<tr>' +
      '<td>' + (r['Full Name'] || r['Student No']) + '</td>' +
      '<td>' + statusBadge(r['Attendance Status']) + '</td>' +
      '<td>' + formatTime(r['Time In'])  + '</td>' +
      '<td>' + formatTime(r['Time Out']) + '</td>' +
    '</tr>';
  }).join('');
}

function startFeedRefresh() {
  clearInterval(_feedTimer);
  _feedTimer = setInterval(function() {
    loadActiveEvent().then(loadLiveFeed);
  }, 15000); // refresh every 15s
}
