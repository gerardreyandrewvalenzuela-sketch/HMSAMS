// ============================================================
// dashboard.js — Dashboard page logic
// ============================================================

var _stats       = null;
var _refreshTimer = null;

async function loadDashboard() {
  try {
    var res = await getDashboardStats();
    if (!res.success) throw new Error(res.message);
    _stats = res.data;
    renderStats(_stats);
  } catch(err) {
    console.error('Dashboard error:', err);
    document.getElementById('stat-active-students').textContent = '!';
  }
}

function renderStats(data) {
  document.getElementById('stat-active-students').textContent = data.activeStudents || 0;
  document.getElementById('stat-total-events').textContent    = data.totalEvents    || 0;
  document.getElementById('stat-active-events').textContent   = data.activeEvents   || 0;
  document.getElementById('stat-today-scans').textContent     = data.todayScans     || 0;

  var activeCard   = document.getElementById('active-event-card');
  var noEventState = document.getElementById('no-event-state');

  if (data.activeEvent) {
    activeCard.style.display   = 'block';
    noEventState.style.display = 'none';

    document.getElementById('active-event-name').textContent = data.activeEvent;

    // Progress bar — scans vs active students
    var total   = data.activeStudents || 0;
    var scanned = data.todayScans     || 0;
    var pct     = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
    document.getElementById('progress-fill').style.width  = pct + '%';
    document.getElementById('active-event-count').textContent =
      scanned + ' / ' + total + ' scanned';
  } else {
    activeCard.style.display   = 'none';
    noEventState.style.display = 'flex';
  }
}

// Auto-refresh every 30 seconds
function startAutoRefresh() {
  clearInterval(_refreshTimer);
  _refreshTimer = setInterval(loadDashboard, 30000);
}

document.addEventListener('DOMContentLoaded', function() {
  loadDashboard();
  startAutoRefresh();
});
