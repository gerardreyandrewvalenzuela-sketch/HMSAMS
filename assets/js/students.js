// ============================================================
// students.js — Student management page
// ============================================================

var _allStudents   = [];
var _pendingRemove = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupPinGate(onPinUnlocked);
});

async function onPinUnlocked() {
  document.getElementById('main-content').style.display = 'block';
  await loadStudents();
  bindUI();
}

// ── Load Students ─────────────────────────────────────────────
async function loadStudents() {
  try {
    var res = await getStudents();
    if (!res.success) throw new Error(res.message);
    _allStudents = res.data || [];
    populateBlockFilter();
    renderStudents();
  } catch(err) {
    showToast('Failed to load students: ' + err.message, 'error');
  }
}

function populateBlockFilter() {
  var blocks  = [...new Set(_allStudents.map(function(s) { return s['Block']; }))].sort();
  var select  = document.getElementById('filter-block');
  // Remove old options except first
  while (select.options.length > 1) select.remove(1);
  blocks.forEach(function(b) {
    if (b) {
      var opt = document.createElement('option');
      opt.value = b; opt.textContent = 'Block ' + b;
      select.appendChild(opt);
    }
  });
}

function renderStudents() {
  var search     = document.getElementById('search-input').value.trim().toLowerCase();
  var yearFilter = document.getElementById('filter-year').value;
  var blockFilter= document.getElementById('filter-block').value;
  var statusFilter=document.getElementById('filter-status').value;

  var filtered = _allStudents.filter(function(s) {
    var fullName = [s['Last Name'], s['First Name'], s['Middle Name']].join(' ').toLowerCase();
    var no       = String(s['Student No']).toLowerCase();

    var matchSearch = !search || fullName.includes(search) || no.includes(search);
    var matchYear   = !yearFilter   || String(s['Year Level']) === yearFilter;
    var matchBlock  = !blockFilter  || String(s['Block'])      === blockFilter;
    var matchStatus = !statusFilter || s['Status']             === statusFilter;

    return matchSearch && matchYear && matchBlock && matchStatus;
  });

  document.getElementById('student-count').textContent =
    'Showing ' + filtered.length + ' of ' + _allStudents.length + ' students';

  var tbody = document.getElementById('students-tbody');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No students found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(s) {
    var no   = escHtml(String(s['Student No']));
    var last = escHtml(s['Last Name']  || '');
    var first= escHtml(s['First Name'] || '');
    var yr   = escHtml(String(s['Year Level'] || ''));
    var blk  = escHtml(s['Block'] || '');
    return '<tr>' +
      '<td>' + no + '</td>' +
      '<td>' + last  + '</td>' +
      '<td>' + first + '</td>' +
      '<td>' + yr  + '</td>' +
      '<td>' + blk + '</td>' +
      '<td>' + statusBadge(s['Status']) + '</td>' +
      '<td class="actions-cell">' +
        '<button class="btn btn--ghost btn--sm" data-action="edit"   data-no="' + no + '"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="btn btn--danger btn--sm" data-action="remove" data-no="' + no + '"><i class="fa-solid fa-trash"></i></button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

// ── Bind UI ──────────────────────────────────────────────────
function bindUI() {
  // Add student button
  document.getElementById('btn-add-student').addEventListener('click', function() {
    openStudentModal(null);
  });

  // Search and filters
  ['search-input','filter-year','filter-block','filter-status'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', renderStudents);
    document.getElementById(id).addEventListener('change', renderStudents);
  });

  // Table actions (delegated)
  document.getElementById('students-tbody').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action    = btn.dataset.action;
    var studentNo = btn.dataset.no;

    if (action === 'edit') {
      var student = _allStudents.find(function(s) {
        return String(s['Student No']) === studentNo;
      });
      if (student) openStudentModal(student);
    } else if (action === 'remove') {
      _pendingRemove = studentNo;
      document.getElementById('confirm-message').textContent =
        'Remove ' + studentNo + ' from the student list?';
      document.getElementById('confirm-modal').style.display = 'flex';
    }
  });

  // Modal save
  document.getElementById('student-modal-save').addEventListener('click', saveStudent);
  document.getElementById('student-modal-close').addEventListener('click', closeStudentModal);
  document.getElementById('student-modal-cancel').addEventListener('click', closeStudentModal);

  // Confirm remove
  document.getElementById('confirm-ok').addEventListener('click', async function() {
    if (!_pendingRemove) return;
    var res = await removeStudent(_pendingRemove);
    if (res.success) {
      showToast('Student removed.', 'success');
      _pendingRemove = null;
      document.getElementById('confirm-modal').style.display = 'none';
      await loadStudents();
    } else {
      showToast(res.message, 'error');
    }
  });
  document.getElementById('confirm-cancel').addEventListener('click', function() {
    _pendingRemove = null;
    document.getElementById('confirm-modal').style.display = 'none';
  });
}

// ── Modal ─────────────────────────────────────────────────────
function openStudentModal(student) {
  document.getElementById('student-form-error').textContent = '';

  if (student) {
    document.getElementById('student-modal-title').textContent    = 'Edit Student';
    document.getElementById('edit-student-original-no').value     = student['Student No'];
    document.getElementById('student-no').value                   = student['Student No'];
    document.getElementById('student-lastname').value             = student['Last Name']   || '';
    document.getElementById('student-firstname').value            = student['First Name']  || '';
    document.getElementById('student-middlename').value           = student['Middle Name'] || '';
    document.getElementById('student-year').value                 = student['Year Level']  || '';
    document.getElementById('student-block').value                = student['Block']       || '';
    document.getElementById('student-status').value               = student['Status']      || 'Active';
  } else {
    document.getElementById('student-modal-title').textContent = 'Add Student';
    document.getElementById('edit-student-original-no').value  = '';
    document.getElementById('student-no').value                = '';
    document.getElementById('student-lastname').value          = '';
    document.getElementById('student-firstname').value         = '';
    document.getElementById('student-middlename').value        = '';
    document.getElementById('student-year').value              = '';
    document.getElementById('student-block').value             = '';
    document.getElementById('student-status').value            = 'Active';
  }

  document.getElementById('student-modal').style.display = 'flex';
}

function closeStudentModal() {
  document.getElementById('student-modal').style.display = 'none';
}

async function saveStudent() {
  var errorEl = document.getElementById('student-form-error');
  errorEl.textContent = '';

  var originalNo = document.getElementById('edit-student-original-no').value;
  var studentNo  = document.getElementById('student-no').value.trim();
  var lastName   = document.getElementById('student-lastname').value.trim();
  var firstName  = document.getElementById('student-firstname').value.trim();
  var middleName = document.getElementById('student-middlename').value.trim();
  var yearLevel  = document.getElementById('student-year').value;
  var block      = document.getElementById('student-block').value.trim();
  var status     = document.getElementById('student-status').value;

  if (!studentNo || !lastName || !firstName || !yearLevel || !block) {
    errorEl.textContent = 'Please fill in all required fields.';
    return;
  }

  var saveBtn = document.getElementById('student-modal-save');
  saveBtn.disabled = true;

  var data = {
    studentNo:  studentNo,
    lastName:   lastName,
    firstName:  firstName,
    middleName: middleName,
    yearLevel:  yearLevel,
    block:      block,
    status:     status
  };

  try {
    var res = originalNo
      ? await updateStudent(originalNo, data)
      : await addStudent(data);

    if (res.success) {
      showToast(originalNo ? 'Student updated.' : 'Student added.', 'success');
      closeStudentModal();
      await loadStudents();
    } else {
      errorEl.textContent = res.message;
    }
  } catch(err) {
    errorEl.textContent = 'Error: ' + err.message;
  }

  saveBtn.disabled = false;
}

// ── Escape HTML ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
