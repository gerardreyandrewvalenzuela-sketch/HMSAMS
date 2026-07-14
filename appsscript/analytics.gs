function rebuildAnalyticsDashboard() {

  var sheet = getSheet("Analytics Dashboard");
  sheet.clear();

  var students = getAllRows(CONFIG.SHEETS.STUDENTS);
  var attendance = getAllRows(CONFIG.SHEETS.ATTENDANCE);
  var events = getAllRows(CONFIG.SHEETS.EVENTS);

  var activeStudents = students.filter(function(s){
    return s.Status == CONFIG.STUDENT_STATUS.ACTIVE;
  }).length;

  var totalEvents = events.length;

  var totalAttendance = attendance.length;

  var timeIn = 0;
  var late = 0;
  var timeout = 0;
  var noTimeout = 0;

  var studentMap = {};

students.forEach(function(s){
    studentMap[String(s["Student No"])] = s;
});

  attendance.forEach(function(a){

    if(a["Time Out"]){
      timeout++;
    }
    else if(a.Status == CONFIG.STATUS.TIME_IN){
      timeIn++;
    }
    else if(a.Status == CONFIG.STATUS.LATE){
      late++;
    }
    else if(a.Status == CONFIG.STATUS.NO_TIMEOUT){
      noTimeout++;
    }

  });

  sheet.getRange("A1").setValue("ATTENDANCE ANALYTICS DASHBOARD");
  sheet.getRange("A1").setFontWeight("bold").setFontSize(18);

  sheet.getRange("A3").setValue("Active Students");
  sheet.getRange("B3").setValue(activeStudents);

  sheet.getRange("A4").setValue("Events");
  sheet.getRange("B4").setValue(totalEvents);

  sheet.getRange("A5").setValue("Attendance Records");
  sheet.getRange("B5").setValue(totalAttendance);

  sheet.getRange("A7").setValue("Time In");
  sheet.getRange("B7").setValue(timeIn);

  sheet.getRange("A8").setValue("Late");
  sheet.getRange("B8").setValue(late);

  sheet.getRange("A9").setValue("Time Out");
  sheet.getRange("B9").setValue(timeout);

  sheet.getRange("A10").setValue("No Timeout");
  sheet.getRange("B10").setValue(noTimeout);
var yearStats = {};

students.forEach(function(s){

    if(s.Status != CONFIG.STUDENT_STATUS.ACTIVE) return;

    if(!yearStats[s["Year Level"]]){

        yearStats[s["Year Level"]] = {
            total:0,
            attended:0
        };

    }

    yearStats[s["Year Level"]].total++;

});

attendance.forEach(function(a){

var student = studentMap[String(a["Student No"])];

    if(!student) return;

    yearStats[student["Year Level"]].attended++;

});

sheet.getRange("D2").setValue("Attendance by Year");

var row = 3;

Object.keys(yearStats).sort().forEach(function(year){

    var y = yearStats[year];

    var percent = y.total
        ? ((y.attended / y.total) * 100).toFixed(1) + "%"
        : "0%";

    sheet.getRange(row,4).setValue(year);
    sheet.getRange(row,5).setValue(percent);

    row++;

});

}

