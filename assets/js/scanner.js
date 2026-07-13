// ============================================================
// scanner.js — Scan result page + live attendance feed
// Continuous scanning enabled: no page redirects, seamless flow
// ============================================================

var _activeEvent  = null;
var _feedTimer    = null;
var _isScanProcessing = false;  // Prevent duplicate rapid scans
var _lastProcessedParams = '';  // Track last scan to prevent duplicates
var _cameraStream = null;        // Track active camera stream
var _scannerActive = false;      // Track if scanner is running

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupPinGate(onPinUnlocked);
});

async function onPinUnlocked() {
  document.getElementById('scanner-content').style.display = 'block';

  // Load active event info
  await loadActiveEvent();

  // Check for scan params in URL (student scanned their QR)
  checkAndProcessScanParams();

  // Load live feed
  loadLiveFeed();
  startFeedRefresh();

  // Manual entry button
  document.getElementById('manual-submit').addEventListener('click', handleManualEntry);
  document.getElementById('manual-student-no').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleManualEntry();
  });
  document.getElementById('manual-student-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleManualEntry();
  });

  // Refresh button
  document.getElementById('refresh-feed').addEventListener('click', function() {
    loadLiveFeed();
  });

  // Camera scanner buttons
  document.getElementById('btn-open-camera').addEventListener('click', initializeCamera);
  document.getElementById('btn-close-camera').addEventListener('click', closeCamera);

  // Monitor URL changes for continuous scanning
  // When camera app scans a new QR code, it navigates to scan.html?id=...
  // We intercept this and process without full page reload
  listenForScanParams();
}

// ── Continuous Scanning: Listen for URL changes ──────────────
function listenForScanParams() {
  // Use popstate to detect browser back/forward (though we control history)
  window.addEventListener('popstate', function(e) {
    checkAndProcessScanParams();
  });

  // Also listen for manual navigation / new tabs opening old URL
  // This uses a polling approach for browser compatibility
  setInterval(function() {
    var params = new URLSearchParams(window.location.search);
    var paramsStr = params.get('id') + '|' + params.get('name') + '|' + params.get('event');
    
    if (paramsStr !== '|null|null' && paramsStr !== _lastProcessedParams && !_isScanProcessing) {
      checkAndProcessScanParams();
    }
  }, 300);
}

// ── Check and Process Scan Params ────────────────────────────
function checkAndProcessScanParams() {
  var params = new URLSearchParams(window.location.search);
  var studentNo = params.get('id') || '';
  var studentName = params.get('name') || '';
  var eventParam = params.get('event') || '';
  
  // Only process if there are actual scan params and we haven't processed them yet
  if (studentNo && !_isScanProcessing) {
    var paramsStr = studentNo + '|' + studentName + '|' + eventParam;
    if (paramsStr !== _lastProcessedParams) {
      _lastProcessedParams = paramsStr;
      handleQrScan(studentNo, studentName, eventParam);
    }
  }
  
  // Always keep URL clean for next scan
  if (studentNo) {
    history.replaceState({}, '', 'scan.html');
  }
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

  // Prevent duplicate rapid submissions
  if (_isScanProcessing) {
    showToast('Processing previous scan...', 'warning');
    return;
  }

  _isScanProcessing = true;
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
      // Auto-focus for next scan
      setTimeout(function() {
        document.getElementById('manual-student-no').focus();
      }, 500);
    }
  } catch(err) {
    showToast('Connection error. Try again.', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> Record Attendance';
  _isScanProcessing = false;
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
  
  var metaText = res.time ? formatDateTime(res.time) : '';
  if (res.eventName) {
    metaText += metaText ? ' — ' + res.eventName : res.eventName;
  }
  if (res.message && !res.time) {
    metaText = res.message;
  }
  metaEl.textContent = metaText;

  el.style.display = 'block';

  // Auto-hide faster for continuous scanning flow (was 10s, now 6s)
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() {
    el.style.display = 'none';
  }, 6000);
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
  // Refresh every 3 seconds to catch quick scan updates (was 15s)
  _feedTimer = setInterval(function() {
    loadActiveEvent().then(loadLiveFeed);
  }, 3000);
}

// ── Camera Scanner Functions ─────────────────────────────────

/**
 * Initialize camera and start QR scanning
 */
var _codeReader = null;

async function initializeCamera() {

    var scanner = document.getElementById("camera-scanner");
    var status = document.getElementById("scanner-status");
    var video = document.getElementById("scanner-video");

    scanner.style.display = "block";
    status.textContent = "Starting camera...";

    _scannerActive = true;

   _codeReader = new ZXingBrowser.BrowserMultiFormatReader();

    try {

        await _codeReader.decodeFromVideoDevice(
            undefined,
            video,
            async (result, err) => {

                if (!_scannerActive) return;

                if (result && !_isScanProcessing) {

                    await processQrScan(result.getText());

                }

            }
        );

       status.textContent = "✅ Camera ready — point at QR code";

    } catch (e) {

        status.textContent = "❌ " + e.message;

    }

}


/**
 * Continuously process video frames to detect QR codes
 */

/**
 * Parse QR code data and process scan
 * QR format: scan.html?id=2024-0001&name=John+Doe
 */
async function processQrScan(qrData) {

    if (_isScanProcessing) return;

    _isScanProcessing = true;

    try {

var studentNo = qrData.trim();

if (studentNo.indexOf("SID:") === 0) {
    studentNo = studentNo.substring(4);
}

var fullName = "";
var eventId = "";

if (!studentNo) {
    console.warn("Invalid QR");
    return;
}

        var scanStr = studentNo + "|" + fullName + "|" + eventId;

        if (scanStr === _lastProcessedParams) {
            console.warn("Duplicate scan ignored.");
            return;
        }

        _lastProcessedParams = scanStr;

        console.log("Processing QR:", studentNo);

        await handleQrScan(studentNo, fullName, eventId);

    }
    catch(err) {

        console.error("QR parse error:", err);

    }
finally {
 
        _isScanProcessing = false;

     setTimeout(function () {
      
        _lastProcessedParams = '';

    }, 400);

}

}
   


/**
 * Close camera and cleanup
 */
function closeCamera() {

    _scannerActive = false;

    if (_codeReader) {
        try {
            _codeReader.stopContinuousDecode();
        } catch (e) {
            console.log("Scanner already stopped.");
        }

        _codeReader = null;
    }

    var video = document.getElementById("scanner-video");

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(function(track) {
            track.stop();
        });

        video.srcObject = null;
    }

    document.getElementById("camera-scanner").style.display = "none";

    document.getElementById("scanner-status").textContent =
        "Camera stopped";

}
