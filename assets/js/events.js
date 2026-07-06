// ============================================================
// events.js — Event management page
// ============================================================

var _allEvents     = [];
var _activeFilter  = 'all';
var _pendingDelete = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupPinGate(onPinUnlocked);
});

async function onPinUnlocked() {
  document.getElementById('main-content').style.display = 'block';
  await loadEvents();
  bindUI();
}

// ── Load Events ──────────────────────────────────────────────
async function loadEvents() {
  try {
    var res = await getEvents();
    if (!res.success) throw new Error(res.message);
    _allEvents = res.data || [];
    renderEvents();
  } catch(err) {
    showToast('Failed to load events: ' + err.message, 'error');
  }
}

function renderEvents() {
  var list     = document.getElementById('events-list');
  var emptyEl  = document.getElementById('events-empty');

  var filtered = _activeFilter === 'all'
    ? _allEvents
    : _allEvents.filter(function(e) { return e['Status'] === _activeFilter; });

  // Remove all event cards (keep empty state element)
  Array.from(list.querySelectorAll('.event-card')).forEach(function(el) { el.remove(); });

  if (!filtered.length) {
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  filtered.forEach(function(ev) {
    list.appendChild(buildEventCard(ev));
  });
}

function buildEventCard(ev) {
  var card = document.createElement('div');
  card.className = 'event-card card' + (ev['Status'] === 'Active' ? ' event-card--active' : '');

  var activateBtn = ev['Status'] !== 'Active'
    ? '<button class="btn btn--outline btn--sm" data-action="activate" data-id="' + ev['Event ID'] + '"><i class="fa-solid fa-bolt"></i> Activate</button>'
    : '<button class="btn btn--ghost btn--sm" data-action="deactivate" data-id="' + ev['Event ID'] + '"><i class="fa-solid fa-pause"></i> Deactivate</button>';

  var archiveBtn = ev['Status'] !== 'Archived'
    ? '<button class="btn btn--ghost btn--sm" data-action="archive" data-id="' + ev['Event ID'] + '"><i class="fa-solid fa-box-archive"></i> Archive</button>'
    : '<button class="btn btn--ghost btn--sm" data-action="unarchive" data-id="' + ev['Event ID'] + '"><i class="fa-solid fa-box-open"></i> Unarchive</button>';

  card.innerHTML =
    '<div class="event-card__header">' +
      '<div class="event-card__name">' + escHtml(ev['Event Name']) + '</div>' +
      statusBadge(ev['Status']) +
    '</div>' +
    '<div class="event-card__meta">' +
      '<span><i class="fa-solid fa-calendar fa-xs"></i> ' + escHtml(String(ev['Date'])) + '</span>' +
      '<span><i class="fa-solid fa-door-open fa-xs"></i> Reg: ' + escHtml(String(ev['Reg Open'])) + ' – ' + escHtml(String(ev['Reg Close'])) + '</span>' +
      '<span><i class="fa-solid fa-clock fa-xs"></i> Timeout: ' + escHtml(String(ev['Timeout Deadline'])) + '</span>' +
    '</div>' +
    '<div class="event-card__actions">' +
      activateBtn +
      archiveBtn +
      '<button class="btn btn--ghost btn--sm" data-action="edit" data-id="' + ev['Event ID'] + '"><i class="fa-solid fa-pen"></i> Edit</button>' +
      '<button class="btn btn--danger btn--sm" data-action="delete" data-id="' + ev['Event ID'] + '"><i class="fa-solid fa-trash"></i> Delete</button>' +
    '</div>';

  return card;
}

// ── Bind UI ──────────────────────────────────────────────────
function bindUI() {
  // New event button
  document.getElementById('btn-new-event').addEventListener('click', function() {
    openModal(null);
  });

  // Tab filters
  document.querySelectorAll('.tab-bar__item').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tab-bar__item').forEach(function(t) {
        t.classList.remove('tab-bar__item--active');
      });
      tab.classList.add('tab-bar__item--active');
      _activeFilter = tab.dataset.filter;
      renderEvents();
    });
  });

  // Event list actions (delegated)
  document.getElementById('events-list').addEventListener('click', async function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action  = btn.dataset.action;
    var eventId = btn.dataset.id;

    switch(action) {
      case 'activate':
        await changeStatus(eventId, 'Active'); break;
      case 'deactivate':
        await changeStatus(eventId, 'Inactive'); break;
      case 'archive':
        await changeStatus(eventId, 'Archived'); break;
      case 'unarchive':
        await changeStatus(eventId, 'Inactive'); break;
      case 'edit':
        var ev = _allEvents.find(function(e) { return e['Event ID'] === eventId; });
        if (ev) openModal(ev);
        break;
      case 'delete':
        _pendingDelete = eventId;
        document.getElementById('confirm-message').textContent =
          'Delete this event? This cannot be undone.';
        document.getElementById('confirm-modal').style.display = 'flex';
        break;
    }
  });

  // Modal save
  document.getElementById('modal-save').addEventListener('click', saveEvent);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  // Confirm delete
  document.getElementById('confirm-ok').addEventListener('click', async function() {
    if (!_pendingDelete) return;
    var res = await deleteEvent(_pendingDelete);
    if (res.success) {
      showToast('Event deleted.', 'success');
      _pendingDelete = null;
      document.getElementById('confirm-modal').style.display = 'none';
      await loadEvents();
    } else {
      showToast(res.message, 'error');
    }
  });
  document.getElementById('confirm-cancel').addEventListener('click', function() {
    _pendingDelete = null;
    document.getElementById('confirm-modal').style.display = 'none';
  });
}

// ── Status Change ─────────────────────────────────────────────
async function changeStatus(eventId, status) {
  try {
    var res = await setEventStatus(eventId, status);
    if (res.success) {
      showToast('Status updated to ' + status + '.', 'success');
      await loadEvents();
    } else {
      showToast(res.message, 'error');
    }
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(ev) {
  var modal = document.getElementById('event-modal');
  document.getElementById('event-form-error').textContent = '';

  if (ev) {
    document.getElementById('modal-title').textContent    = 'Edit Event';
    document.getElementById('edit-event-id').value        = ev['Event ID'];
    document.getElementById('event-name').value           = ev['Event Name'];
    document.getElementById('event-date').value           = ev['Date'];
    document.getElementById('event-reg-open').value       = ev['Reg Open'];
    document.getElementById('event-reg-close').value      = ev['Reg Close'];
    document.getElementById('event-timeout').value        = ev['Timeout Deadline'];
  } else {
    document.getElementById('modal-title').textContent = 'New Event';
    document.getElementById('edit-event-id').value      = '';
    document.getElementById('event-name').value         = '';
    document.getElementById('event-date').value         = '';
    document.getElementById('event-reg-open').value     = '';
    document.getElementById('event-reg-close').value    = '';
    document.getElementById('event-timeout').value      = '';
  }

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('event-modal').style.display = 'none';
}

async function saveEvent() {
  var errorEl = document.getElementById('event-form-error');
  errorEl.textContent = '';

  var name    = document.getElementById('event-name').value.trim();
  var date    = document.getElementById('event-date').value;
  var regOpen = document.getElementById('event-reg-open').value;
  var regClose= document.getElementById('event-reg-close').value;
  var timeout = document.getElementById('event-timeout').value;
  var editId  = document.getElementById('edit-event-id').value;

  if (!name || !date || !regOpen || !regClose || !timeout) {
    errorEl.textContent = 'All fields are required.';
    return;
  }
  if (regClose <= regOpen) {
    errorEl.textContent = 'Reg Close must be after Reg Open.';
    return;
  }
  if (timeout <= regClose) {
    errorEl.textContent = 'Timeout Deadline must be after Reg Close.';
    return;
  }

  var saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;

  var data = {
    eventName:       name,
    date:            date,
    regOpen:         regOpen,
    regClose:        regClose,
    timeoutDeadline: timeout,
    status:          editId
      ? (_allEvents.find(function(e) { return e['Event ID'] === editId; }) || {})['Status'] || 'Inactive'
      : 'Inactive'
  };

  try {
    var res = editId
      ? await updateEvent(editId, data)
      : await addEvent(data);

    if (res.success) {
      showToast(editId ? 'Event updated.' : 'Event created.', 'success');
      closeModal();
      await loadEvents();
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
