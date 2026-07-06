// ============================================================
// students.gs — Student CRUD operations
// ============================================================

// Column indices for Students sheet (0-based)
var STUDENT_COLS = {
  STUDENT_NO:  0,
  LAST_NAME:   1,
  FIRST_NAME:  2,
  MIDDLE_NAME: 3,
  YEAR_LEVEL:  4,
  BLOCK:       5,
  STATUS:      6
};

function getAllStudents() {
  return getAllRows(CONFIG.SHEETS.STUDENTS);
}

function getStudentByNo(studentNo) {
  var students = getAllStudents();
  return students.find(function(s) {
    return String(s['Student No']) === String(studentNo);
  }) || null;
}

function addStudent(data) {
  // Check for duplicate Student No
  var existing = getStudentByNo(data.studentNo);
  if (existing) {
    return { success: false, message: 'Student No. already exists.' };
  }
  appendRow(CONFIG.SHEETS.STUDENTS, [
    data.studentNo,
    data.lastName,
    data.firstName,
    data.middleName || '',
    data.yearLevel,
    data.block,
    data.status || CONFIG.STUDENT_STATUS.ACTIVE
  ]);
  return { success: true, message: 'Student added.' };
}

function updateStudent(studentNo, data) {
  var rowIndex = findRowIndex(CONFIG.SHEETS.STUDENTS, STUDENT_COLS.STUDENT_NO, studentNo);
  if (rowIndex === -1) {
    return { success: false, message: 'Student not found.' };
  }
  updateRow(CONFIG.SHEETS.STUDENTS, rowIndex, [
    data.studentNo || studentNo,
    data.lastName,
    data.firstName,
    data.middleName || '',
    data.yearLevel,
    data.block,
    data.status
  ]);
  return { success: true, message: 'Student updated.' };
}

function removeStudent(studentNo) {
  var rowIndex = findRowIndex(CONFIG.SHEETS.STUDENTS, STUDENT_COLS.STUDENT_NO, studentNo);
  if (rowIndex === -1) {
    return { success: false, message: 'Student not found.' };
  }
  deleteRow(CONFIG.SHEETS.STUDENTS, rowIndex);
  return { success: true, message: 'Student removed.' };
}

function setStudentStatus(studentNo, status) {
  var rowIndex = findRowIndex(CONFIG.SHEETS.STUDENTS, STUDENT_COLS.STUDENT_NO, studentNo);
  if (rowIndex === -1) {
    return { success: false, message: 'Student not found.' };
  }
  updateCell(CONFIG.SHEETS.STUDENTS, rowIndex, STUDENT_COLS.STATUS + 1, status);
  return { success: true, message: 'Status updated.' };
}

function getStudentStats() {
  var students = getAllStudents();
  var active   = students.filter(function(s) { return s['Status'] === CONFIG.STUDENT_STATUS.ACTIVE; });
  return {
    total:  students.length,
    active: active.length
  };
}
