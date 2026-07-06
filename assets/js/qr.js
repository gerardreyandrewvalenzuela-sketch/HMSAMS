// ============================================================
// qr.js — QR code generator page
// ============================================================

// Base URL for QR scan links
var QR_BASE_URL = 'https://gerardreyandrewvalenzuela-sketch.github.io/HMSAMS/scan.html';

var _allStudents = [];

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupPinGate(onPinUnlocked);
});

async function onPinUnlocked() {
  document.getElementById('main-content').style.display = 'block';
  await loadStudentsForQR();
  bindUI();
}

// ── Load Students ─────────────────────────────────────────────
async function loadStudentsForQR() {
  try {
    var res = await getStudents();
    if (!res.success) throw new Error(res.message);
    _allStudents = (res.data || []).filter(function(s) {
      return s['Status'] === 'Active';
    });
    populateBlockFilter();
    document.getElementById('qr-count').textContent =
      _allStudents.length + ' active students';
  } catch(err) {
    showToast('Failed to load students: ' + err.message, 'error');
  }
}

function populateBlockFilter() {
  var blocks = [...new Set(_allStudents.map(function(s) { return s['Block']; }))].sort();
  var select = document.getElementById('filter-block');
  while (select.options.length > 1) select.remove(1);
  blocks.forEach(function(b) {
    if (b) {
      var opt = document.createElement('option');
      opt.value = b; opt.textContent = 'Block ' + b;
      select.appendChild(opt);
    }
  });
}

// ── Bind UI ──────────────────────────────────────────────────
function bindUI() {
  document.getElementById('btn-generate').addEventListener('click', generateQRCodes);
  document.getElementById('filter-block').addEventListener('change', generateQRCodes);
  document.getElementById('filter-year').addEventListener('change', generateQRCodes);
}

// ── Generate QR Codes ────────────────────────────────────────
function generateQRCodes() {
  var blockFilter = document.getElementById('filter-block').value;
  var yearFilter  = document.getElementById('filter-year').value;

  var filtered = _allStudents.filter(function(s) {
    var matchBlock = !blockFilter || String(s['Block'])      === blockFilter;
    var matchYear  = !yearFilter  || String(s['Year Level']) === yearFilter;
    return matchBlock && matchYear;
  });

  document.getElementById('qr-count').textContent =
    'Showing ' + filtered.length + ' of ' + _allStudents.length + ' active students';

  var grid = document.getElementById('qr-grid');
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-qrcode"></i><p>No students match the filter.</p></div>';
    return;
  }

  filtered.forEach(function(student) {
    var item = buildQRItem(student);
    grid.appendChild(item);
  });
}

function buildQRItem(student) {
  var fullName = [
    student['First Name'],
    student['Middle Name'] ? student['Middle Name'].charAt(0) + '.' : '',
    student['Last Name']
  ].filter(Boolean).join(' ');

  var studentNo = String(student['Student No']);

  // Build the QR scan URL
  var url = QR_BASE_URL +
    '?id='   + encodeURIComponent(studentNo) +
    '&name=' + encodeURIComponent(fullName);

  // Build item container
  var item = document.createElement('div');
  item.className = 'qr-item';

  // QR container
  var qrDiv = document.createElement('div');
  qrDiv.className = 'qr-item__qr';

  // Name and number
  var nameEl = document.createElement('div');
  nameEl.className = 'qr-item__name';
  nameEl.textContent = fullName;

  var noEl = document.createElement('div');
  noEl.className = 'qr-item__no';
  noEl.textContent = studentNo + ' | ' + (student['Year Level'] || '') + (student['Block'] || '');

  item.appendChild(qrDiv);
  item.appendChild(nameEl);
  item.appendChild(noEl);

  // Generate QR code using qrcode.js
  try {
    new QRCode(qrDiv, {
      text:          url,
      width:         140,
      height:        140,
      colorDark:     '#1e293b',
      colorLight:    '#ffffff',
      correctLevel:  QRCode.CorrectLevel.M
    });
  } catch(e) {
    qrDiv.textContent = 'QR error';
  }

  return item;
}
