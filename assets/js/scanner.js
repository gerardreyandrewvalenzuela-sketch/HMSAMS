// ============================================================
// scanner.js
// QR Scanner & Live Attendance
// HMSAMS v1.1
// ============================================================



// ============================================================
// Constants
// ============================================================

var FEED_REFRESH_INTERVAL = 15000;
var RESULT_HIDE_DELAY = 8000;



// ============================================================
// State
// ============================================================

var _activeEvent = null;
var _feedTimer = null;



// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    setupPinGate(onPinUnlocked);
});



/**
 * Called after the administrator successfully enters the PIN.
 */
async function onPinUnlocked() {

    document.getElementById('scanner-content').style.display = 'block';

    // --------------------------------------------------------
    // Read URL parameters
    // --------------------------------------------------------

    var params = new URLSearchParams(window.location.search);

    var studentNo = params.get('id') || '';
    var studentName = params.get('name') || '';
    var eventParam = params.get('event') || '';

    // --------------------------------------------------------
    // Load active event
    // --------------------------------------------------------

    await loadActiveEvent();

    // --------------------------------------------------------
    // QR Scan
    // --------------------------------------------------------

    if (studentNo) {

        await handleQrScan(
            studentNo,
            studentName,
            eventParam
        );

        // Prevent refresh from scanning again
        history.replaceState({}, '', 'scan.html');

    }

    // --------------------------------------------------------
    // Initial live feed
    // --------------------------------------------------------

    loadLiveFeed();
    startFeedRefresh();

    // --------------------------------------------------------
    // Manual attendance
    // --------------------------------------------------------

    document
        .getElementById('manual-submit')
        .addEventListener('click', handleManualEntry);

    document
        .getElementById('manual-student-no')
        .addEventListener('keydown', function (e) {

            if (e.key === 'Enter') {
                handleManualEntry();
            }

        });

    // --------------------------------------------------------
    // Manual refresh
    // --------------------------------------------------------

    document
        .getElementById('refresh-feed')
        .addEventListener('click', loadLiveFeed);

}



/**
 * Loads the currently active event.
 */
async function loadActiveEvent() {

    try {

        var response = await getActiveEvent();

        _activeEvent = response.data || null;

        var nameEl = document.getElementById('current-event-name');
        var badgeEl = document.getElementById('event-status-badge');
        var warnEl = document.getElementById('no-event-warning');
        var instructionEl = document.getElementById('scanner-instructions');

        if (_activeEvent) {

            nameEl.textContent = _activeEvent['Event Name'];

            badgeEl.style.display = 'inline-block';
            warnEl.style.display = 'none';
            instructionEl.style.display = 'block';

        } else {

            nameEl.textContent = 'No active event';

            badgeEl.style.display = 'none';
            warnEl.style.display = 'flex';
            instructionEl.style.display = 'none';

        }

    } catch (error) {

        console.error('[Scanner] Failed to load active event.', error);

    }

}



/**
 * Processes attendance from a QR code.
 */
async function handleQrScan(studentNo, studentName, eventId) {

    if (!_activeEvent && !eventId) {

        showScanResult({
            success: false,
            status: 'error',
            message: 'No active event. Please activate an event first.'
        });

        return;

    }

    var actualEventId = eventId ||
        (_activeEvent ? _activeEvent['Event ID'] : '');

    await submitAttendance(
        studentNo,
        studentName,
        actualEventId
    );

}



/**
 * Handles manual attendance.
 */
async function handleManualEntry() {

    var studentNo =
        document.getElementById('manual-student-no').value.trim();

    var studentName =
        document.getElementById('manual-student-name').value.trim();

    if (!studentNo || !studentName) {

        showToast(
            'Please enter both Student No. and Full Name.',
            'error'
        );

        return;

    }

    if (!_activeEvent) {

        showToast(
            'No active event.',
            'error'
        );

        return;

    }

    var button = document.getElementById('manual-submit');

    button.disabled = true;
    button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Recording...';

    var result = await submitAttendance(
        studentNo,
        studentName,
        _activeEvent['Event ID']
    );

    if (result.success) {

        document.getElementById('manual-student-no').value = '';
        document.getElementById('manual-student-name').value = '';

    }

    button.disabled = false;
    button.innerHTML =
        '<i class="fa-solid fa-check"></i> Record Attendance';

}



/**
 * Sends attendance to the backend.
 * Shared by QR Scan and Manual Entry.
 */
async function submitAttendance(studentNo, studentName, eventId) {

    try {

        var result = await processScan(
            studentNo,
            studentName,
            eventId
        );

        showScanResult(result);

        if (result.success) {
            await loadLiveFeed();
        }

        return result;

    } catch (error) {

        console.error(
            '[Scanner] Attendance submission failed.',
            error
        );

        var failure = {
            success: false,
            status: 'error',
            message: 'Connection error. Please try again.'
        };

        showScanResult(failure);

        return failure;

    }

}

// ============================================================
// UI Rendering
// ============================================================

/**
 * Displays the attendance result banner.
 */
function showScanResult(result) {

    var container = document.getElementById('scan-result');
    var icon = document.getElementById('scan-result-icon');
    var status = document.getElementById('scan-result-status');
    var name = document.getElementById('scan-result-name');
    var meta = document.getElementById('scan-result-meta');

    container.className = 'scan-result';

    var iconText = '';
    var statusText = '';
    var cssClass = '';

    if (!result.success) {

        iconText = '⚠️';

        if (result.status === 'Duplicate Scan') {
            statusText = 'Already Scanned';
            cssClass = 'duplicate';
        } else {
            statusText = 'Error';
            cssClass = 'error';
        }

    } else {

        switch (result.status) {

            case 'Time In':
                iconText = '✅';
                statusText = 'TIME IN';
                cssClass = 'timein';
                break;

            case 'Late':
                iconText = '🕐';
                statusText = 'LATE';
                cssClass = 'late';
                break;

            case 'Time Out':
                iconText = '👋';
                statusText = 'TIME OUT';
                cssClass = 'timeout';
                break;

            case 'No Timeout':
                iconText = '⏰';
                statusText = 'NO TIME OUT';
                cssClass = 'notimeout';
                break;

            default:
                iconText = 'ℹ️';
                statusText = result.status || 'Success';
                cssClass = 'timein';

        }

    }

    container.classList.add('scan-result--' + cssClass);

    icon.textContent = iconText;
    status.textContent = statusText;
    name.textContent = result.student || '';

    if (result.time) {

        meta.textContent =
            formatDateTime(result.time) +
            ' — ' +
            (result.eventName || '');

    } else {

        meta.textContent = result.message || '';

    }

    container.style.display = 'block';

    clearTimeout(container._hideTimer);

    container._hideTimer = setTimeout(function () {

        container.style.display = 'none';

    }, RESULT_HIDE_DELAY);

}



// ============================================================
// Live Attendance Feed
// ============================================================

/**
 * Loads attendance records for the active event.
 */
async function loadLiveFeed() {

    if (!_activeEvent) {
        return;
    }

    try {

        var response = await getEventAttendance(
            _activeEvent['Event ID']
        );

        if (!response.success) {
            return;
        }

        renderFeed(response.data || []);

    } catch (error) {

        console.error(
            '[Scanner] Failed to load attendance feed.',
            error
        );

    }

}



/**
 * Renders the live attendance table.
 */
function renderFeed(records) {

    var tbody = document.getElementById('attendance-tbody');

    if (!records.length) {

        tbody.innerHTML =
            '<tr><td colspan="4" class="text-center">No records yet.</td></tr>';

        return;

    }

    records.sort(function (a, b) {

        return new Date(b['Time In']) - new Date(a['Time In']);

    });

    tbody.innerHTML = records.map(function (record) {

        return [
            '<tr>',
            '<td>',
            (record['Full Name'] || record['Student No']),
            '</td>',
            '<td>',
            statusBadge(record['Attendance Status']),
            '</td>',
            '<td>',
            formatTime(record['Time In']),
            '</td>',
            '<td>',
            formatTime(record['Time Out']),
            '</td>',
            '</tr>'
        ].join('');

    }).join('');

}

// ============================================================
// Feed Refresh
// ============================================================

/**
 * Starts automatic refresh of the live attendance feed.
 */
function startFeedRefresh() {

    // Prevent multiple timers
    stopFeedRefresh();

    _feedTimer = setInterval(async function () {

        try {

            await loadActiveEvent();
            await loadLiveFeed();

        } catch (error) {

            console.error(
                '[Scanner] Feed refresh failed.',
                error
            );

        }

    }, FEED_REFRESH_INTERVAL);

}



/**
 * Stops the automatic refresh timer.
 */
function stopFeedRefresh() {

    if (_feedTimer) {

        clearInterval(_feedTimer);
        _feedTimer = null;

    }

}



// ============================================================
// Cleanup
// ============================================================

/**
 * Prevent memory leaks when leaving the page.
 */
window.addEventListener('beforeunload', function () {

    stopFeedRefresh();

});



// ============================================================
// End of File
// ============================================================
