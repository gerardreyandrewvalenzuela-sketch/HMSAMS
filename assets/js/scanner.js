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

var _lastScan = {
    value: '',
    time: 0
};

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

    if (_isScanProcessing) return;
    _isScanProcessing = true;

    try {

        if (!_activeEvent && !eventId) {
            showScanResult({
                success:false,
                status:'error',
                message:'No active event.'
            });
            return;
        }

        var eid = eventId || _activeEvent['Event ID'];

        var res = await processScan(studentNo, studentName, eid);

        showScanResult(res);

        if (res.success) {
            loadLiveFeed();
        }

    } catch(err) {

        showScanResult({
            success:false,
            status:'error',
            message:'Connection error.'
        });

    } finally {

        _isScanProcessing = false;

    }
}

// ── Manual Entry ─────────────────────────────────────────────
async function handleManualEntry() {
  var studentNo = document.getElementById('manual-student-no').value.trim();
  var studentName = document.getElementById('manual-student-name').value.trim();

  if (!studentNo || !studentName) {
    showToast('Please enter both Student No. and Full Name.', 'error');
    return;
  }

  if (!_activeEvent) {
    showToast('No active event.', 'error');
    return;
  }

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
      document.getElementById('manual-student-no').value = '';
      document.getElementById('manual-student-name').value = '';
      loadLiveFeed();

      setTimeout(function () {
        document.getElementById('manual-student-no').focus();
      }, 500);
    }

  } catch (err) {
    showToast('Connection error. Try again.', 'error');

  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Record Attendance';
    _isScanProcessing = false;
  }
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
async function initializeCamera() {
  var scanner = document.getElementById('camera-scanner');
  var status  = document.getElementById('scanner-status');
  
  try {
    status.textContent = 'Requesting camera access...';
    
    // Request camera stream
_cameraStream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    focusMode: 'continuous'
  },
  audio: false
});
    
    // Set video source
    var video = document.getElementById('scanner-video');
    video.srcObject = _cameraStream;

    const track = _cameraStream.getVideoTracks()[0];

try {
  const capabilities = track.getCapabilities();

  if (capabilities.focusMode) {
    await track.applyConstraints({
      advanced: [{
        focusMode: 'continuous'
      }]
    });
  }

  if (capabilities.torch) {
    console.log('Torch available');
  }
} catch(e) {
  console.log('Advanced camera settings unsupported');
}
    
    scanner.style.display = 'block';
    status.textContent = 'Starting camera...';
    _scannerActive = true;
    
    // Wait for video to be ready before starting scan loop
    video.onloadedmetadata = function() {
      video.play();
      status.textContent = '✅ Camera ready — point at QR code';
      // Small delay to ensure video is fully playing
      setTimeout(startScannerLoop, 500);
    };
    
    // Fallback timeout in case onloadedmetadata doesn't fire
    setTimeout(function() {
      if (_scannerActive && video.videoWidth === 0) {
        startScannerLoop();
      }
    }, 2000);
    
  } catch(err) {
    if (err.name === 'NotAllowedError') {
      status.textContent = '❌ Camera access denied. Please allow camera access.';
    } else if (err.name === 'NotFoundError') {
      status.textContent = '❌ No camera found on this device.';
    } else {
      status.textContent = '❌ Camera error: ' + err.message;
    }
  }
}

/**
 * Continuously process video frames to detect QR codes
 */
function startScannerLoop() {
  var video = document.getElementById('scanner-video');
  var canvas = document.getElementById('scanner-canvas');
  var status = document.getElementById('scanner-status');
  var hint = document.getElementById('scanner-hint');
  
  if (!canvas || !video) return;
  
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var lastDetectedQR = '';
  var lastDetectedTime = 0;

  
  // Safety counter to prevent infinite waiting
  var readyAttempts = 0;
  
  async function scanFrame() {
    if (!_scannerActive) return;
    
    // Wait for video to have valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      readyAttempts++;
      if (readyAttempts < 100) {
        requestAnimationFrame(scanFrame);
        return;
      }
    }
    
    // Set canvas size to match video
if (
    canvas.width !== video.videoWidth ||
    canvas.height !== video.videoHeight
) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}
    
    // Safety check - if canvas still has no dimensions, skip frame
    if (canvas.width === 0 || canvas.height === 0) {
      requestAnimationFrame(scanFrame);
      return;
    }
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Process every 2nd frame for speed (skip every other frame)
      try {
        // Get image data (now safe since canvas has dimensions)
const scanSize = Math.floor(
    Math.min(canvas.width, canvas.height) * 0.9
);

const sx = Math.floor((canvas.width - scanSize) / 2);
const sy = Math.floor((canvas.height - scanSize) / 2);
var imageData = ctx.getImageData(
  sx,
  sy,
  scanSize,
  scanSize
);
        
        // Process with jsQR
       var qrCode = jsQR(
  imageData.data,
  imageData.width,
  imageData.height,
  {
    inversionAttempts: "attemptBoth"
  }
);
        
        if (qrCode && qrCode.data) {
          var qrData = qrCode.data;
          
          // Only process if different from last detected QR
          if (qrData !== lastDetectedQR ||
    Date.now() - lastDetectedTime > 2000) {
             lastDetectedQR = qrData;
             lastDetectedTime = Date.now();

              hint.textContent = '✅ QR detected!';
              status.textContent = 'Processing...';
            
            // Process the scan with small delay to show detection
            
await processQrScan(qrData);

status.textContent = '✅ Camera ready — point at QR code';
hint.textContent = '↻ Point at QR code';

await new Promise(resolve => setTimeout(resolve, 300));
            
            }
          }
            else {
          hint.textContent = '↻ Point at QR code';
         
        }
      } catch(err) {
        console.error('QR scan error:', err);
      }
    }
    
  
    requestAnimationFrame(scanFrame);
  }
  
  scanFrame();

/**
 * Parse QR code data and process scan
 * QR format: scan.html?id=2024-0001&name=John+Doe
 */
async function processQrScan(qrData) {
  if (_isScanProcessing) return;
  
  try {
    var studentNo = '';
    var fullName = '';
    var eventId = '';
    
    // Try to parse as URL first
    try {
      var url = new URL(qrData, window.location.origin);
      studentNo = url.searchParams.get('id') || '';
      fullName = url.searchParams.get('name') || '';
      eventId = url.searchParams.get('event') || '';
    } catch(e) {
      // If URL parsing fails, try to extract from query string
      // QR data might be: "scan.html?id=2024-0001&name=John+Doe"
      if (qrData.indexOf('id=') !== -1) {
        var idMatch = qrData.match(/[?&]id=([^&]+)/);
        var nameMatch = qrData.match(/[?&]name=([^&]+)/);
        var eventMatch = qrData.match(/[?&]event=([^&]+)/);
        
        if (idMatch) studentNo = decodeURIComponent(idMatch[1]);
        if (nameMatch) fullName = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ');
        if (eventMatch) eventId = decodeURIComponent(eventMatch[1]);
      }
    }
    
    if (!studentNo) {
      console.warn('No student ID found in QR:', qrData);
      return;
    }
    
    // Prevent duplicate scans

var scanStr = studentNo + '|' + fullName + '|' + eventId;

if (
    _lastScan.value === scanStr &&
    Date.now() - _lastScan.time < 5000
) {
    console.warn('Duplicate scan ignored');
    return;
}

_lastScan.value = scanStr;
_lastScan.time = Date.now();

console.log('Processing QR scan:', {
    studentNo,
    fullName,
    eventId
});

await handleQrScan(studentNo, fullName, eventId);
    
  } catch(err) {
    console.error('QR parse error:', err);
  }
}

/**
 * Close camera and cleanup
 */
function closeCamera() {
  _scannerActive = false;
  
  // Stop all tracks
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(function(track) {
      track.stop();
    });
    _cameraStream = null;
  }
  
  // Hide scanner
  document.getElementById('camera-scanner').style.display = 'none';
}
