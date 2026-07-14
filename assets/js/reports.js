// ============================================================
// reports.js
// Reports Page Logic
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    initializeReportsPage();

});

async function initializeReportsPage() {

    await loadReportFilters();

    bindButtons();

}

async function loadReportFilters() {

    try {

        var studentsRes = await getStudents();
        var eventsRes = await getEvents();

        if (!studentsRes.success || !eventsRes.success) {

            showToast("Unable to load report filters.", "error");
            return;

        }

      var activeStudents = (studentsRes.data || []).filter(function(student){

    return student.Status === "Active";

});
        populateEvents(eventsRes.data || []);
        populateYears(activeStudents);
        populateBlocks(activeStudents);

    }

    catch (err) {

        console.error(err);

        showToast("Unable to load report filters.", "error");

    }

}

function populateEvents(events) {

    var select = document.getElementById("report-event");

    select.innerHTML =
        '<option value="">All Events</option>';

events.forEach(function (event) {

    if (event.Status === "Archived") return;

    var option = document.createElement("option");

    option.value = event["Event ID"];

    option.textContent =
        event["Event Name"] +
        " (" +
        event["Event ID"] +
        ")";

    select.appendChild(option);

});

}

function populateYears(students) {

    var years = {};

    students.forEach(function (student) {

        if (student["Year Level"]) {

            years[student["Year Level"]] = true;

        }

    });

    var select = document.getElementById("report-year");

    select.innerHTML =
        '<option value="">All Years</option>';

    Object.keys(years)
        .sort()
        .forEach(function (year) {

            var option =
                document.createElement("option");

            option.value = year;

            option.textContent = year;

            select.appendChild(option);

        });

}

function populateBlocks(students) {

    var blocks = {};

    students.forEach(function (student) {

        if (student["Block"]) {

            blocks[student["Block"]] = true;

        }

    });

    var select = document.getElementById("report-block");

    select.innerHTML =
        '<option value="">All Blocks</option>';

    Object.keys(blocks)
        .sort()
        .forEach(function (block) {

            var option =
                document.createElement("option");

            option.value = block;

            option.textContent = block;

            select.appendChild(option);

        });

}

function bindButtons() {

    document
        .getElementById("btn-attendance-report")
        .addEventListener(
            "click",
            generateAttendanceReport
        );

    document
        .getElementById("btn-summary-report")
        .addEventListener(
            "click",
            generateSummaryReport
        );

    document
        .getElementById("btn-history-report")
        .addEventListener(
            "click",
            generateHistoryReport
        );

}

async function generateAttendanceReport() {

    var filters = {

        eventId:
            document.getElementById("report-event").value,

        year:
            document.getElementById("report-year").value,

        block:
            document.getElementById("report-block").value

    };

    try {

        var btn =
            document.getElementById("btn-attendance-report");

        btn.disabled = true;

        btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

        var res =
            await window.requestAttendanceReport(filters);

        if (res.success) {

            showToast(
                res.message,
                "success"
            );

        }
        else {

            showToast(
                res.message,
                "error"
            );

        }

    }

    catch(err) {

        console.error(err);

        showToast(
            "Unable to generate report.",
            "error"
        );

    }

    finally {

        btn.disabled = false;

        btn.innerHTML =
            "Generate Report";

    }

}

async function generateSummaryReport() {

    var filters = {

        eventId:
            document.getElementById("report-event").value,

        year:
            document.getElementById("report-year").value,

        block:
            document.getElementById("report-block").value

    };

    try {

        var btn =
            document.getElementById("btn-summary-report");

        btn.disabled = true;

        btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

        var res =
            await window.requestSummaryReport(filters);

        if (res.success) {

            showToast(
                res.message,
                "success"
            );

        }
        else {

            showToast(
                res.message,
                "error"
            );

        }

    }

    catch (err) {

        console.error(err);

        showToast(
            "Unable to generate summary report.",
            "error"
        );

    }

    finally {

        btn.disabled = false;

        btn.innerHTML =
            "Generate Summary";

    }

}

async function generateHistoryReport() {

    showToast("Student History Report is not implemented yet.", "warning");

}
