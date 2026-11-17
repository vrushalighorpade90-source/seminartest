import type { SeminarTest } from '../types';

export function computePresenterMarks(test: SeminarTest) {
  const hasPresenter = Boolean(test.presenterRoll && test.presenterRoll > 0);
  const submissions = Object.values(test.submissions || {});
  const totalSubmissions = submissions.length;
  const avgAttendeeScore = totalSubmissions > 0
    ? submissions.reduce((sum, s) => sum + s.score, 0) / totalSubmissions
    : 0;

  const maxHalf = test.totalMarks / 2;
  const attendee50Component = test.totalMarks > 0
    ? (avgAttendeeScore / test.totalMarks) * maxHalf
    : 0;

  const presenterTotal = hasPresenter ? ((test.presenterTeacherMarks || 0) + attendee50Component) : 0;
  const percentage = test.totalMarks > 0 ? (presenterTotal / test.totalMarks) * 100 : 0;

  return {
    hasPresenter,
    teacherScore: test.presenterTeacherMarks || 0,
    maxTeacherScore: maxHalf,
    audienceAvgScore: Math.round(avgAttendeeScore * 100) / 100,
    audience50Component: Math.round(attendee50Component * 100) / 100,
    maxAudienceComponent: maxHalf,
    finalTotal: Math.round(presenterTotal * 100) / 100,
    maxTotal: test.totalMarks,
    percentage: Math.round(percentage * 10) / 10,
    attendeesSubmittedCount: totalSubmissions
  };
}

export function generateGoogleSheetsTSV(test: SeminarTest): string {
  const p = computePresenterMarks(test);
  const rows: string[] = [];

  rows.push(['SEMINAR ASSESSMENT & TEST MARKSHEET'].join('\t'));
  rows.push([`Program:`, test.program, `Course:`, test.course].join('\t'));
  rows.push([`Semester:`, test.semester, `Test Code:`, test.code].join('\t'));
  rows.push([`Topic:`, test.topic, `Duration:`, `${test.durationMinutes} mins`].join('\t'));
  rows.push([`Total Enrolled Students:`, `${test.totalStudents}`, `Total Test Marks:`, `${test.totalMarks}`].join('\t'));
  rows.push([`Test Mode:`, p.hasPresenter ? `Seminar Evaluation (Speaker Roll #${test.presenterRoll})` : `General Purpose Test (All Students Attend)`].join('\t'));
  rows.push([''].join('\t'));

  if (p.hasPresenter) {
    rows.push(['--- SEMINAR SPEAKER EVALUATION (50% FACULTY + 50% AUDIENCE AVERAGE) ---'].join('\t'));
    rows.push([
      'Speaker Roll No',
      'Speaker Name',
      `Faculty Score (Max ${p.maxTeacherScore})`,
      `Audience Avg (Max ${p.maxAudienceComponent})`,
      `Final Total Marks (Max ${p.maxTotal})`,
      'Percentage',
      'Evaluation Rule'
    ].join('\t'));

    rows.push([
      `Roll #${test.presenterRoll}`,
      test.presenterName || 'Designated Speaker',
      `${p.teacherScore}`,
      `${p.audience50Component}`,
      `${p.finalTotal}`,
      `${p.percentage}%`,
      '50% Faculty Marks + 50% Audience Test Average'
    ].join('\t'));
    rows.push([''].join('\t'));
  } else {
    rows.push(['--- GENERAL PURPOSE TEST: ALL STUDENTS EVALUATED ON WRITTEN TEST ---'].join('\t'));
    rows.push(['Status:', 'General Purpose Exam (No Seminar Speaker Exemption)'].join('\t'));
    rows.push([''].join('\t'));
  }

  rows.push(['--- STUDENT TEST RESULTS ---'].join('\t'));
  rows.push([
    'Roll Number',
    'Role',
    'Marks Obtained',
    'Max Marks',
    'Percentage (%)',
    'Test Status',
    'Submission Timestamp'
  ].join('\t'));

  for (let roll = 1; roll <= test.totalStudents; roll++) {
    const isPresenter = Boolean(p.hasPresenter && test.presenterRoll && roll === test.presenterRoll);
    const sub = test.submissions ? test.submissions[roll] : undefined;

    if (isPresenter) {
      rows.push([
        `Roll ${roll}`,
        'Seminar Speaker',
        `${p.finalTotal}`,
        `${test.totalMarks}`,
        `${p.percentage}%`,
        'Speaker (50/50 Evaluated)',
        'Exempt from written test'
      ].join('\t'));
    } else if (sub) {
      rows.push([
        `Roll ${roll}`,
        p.hasPresenter ? 'Seminar Attendee' : 'Student',
        `${sub.score}`,
        `${test.totalMarks}`,
        `${sub.percentage}%`,
        'Submitted',
        new Date(sub.submittedAt).toLocaleTimeString()
      ].join('\t'));
    } else {
      rows.push([
        `Roll ${roll}`,
        p.hasPresenter ? 'Seminar Attendee' : 'Student',
        '0',
        `${test.totalMarks}`,
        '0.0%',
        'Pending / Absent',
        '-'
      ].join('\t'));
    }
  }

  return rows.join('\n');
}

export function generateGoogleSheetsCSV(test: SeminarTest) {
  const p = computePresenterMarks(test);
  const rows: string[][] = [];

  rows.push(['SEMINAR ASSESSMENT & TEST MARKSHEET']);
  rows.push(['Program', test.program, 'Course', test.course]);
  rows.push(['Semester', test.semester, 'Test Code', test.code]);
  rows.push(['Seminar Topic', test.topic, 'Duration (Mins)', `${test.durationMinutes}`]);
  rows.push(['Total Enrolled', `${test.totalStudents}`, 'Total Test Marks', `${test.totalMarks}`]);
  rows.push(['Test Mode', p.hasPresenter ? `Seminar Evaluation (Speaker Roll #${test.presenterRoll})` : `General Purpose Test (All Students Attend)`]);
  rows.push([]);

  if (p.hasPresenter) {
    rows.push(['SEMINAR SPEAKER EVALUATION']);
    rows.push([
      'Speaker Roll',
      'Speaker Name',
      `Faculty 50% Marks (Max ${p.maxTeacherScore})`,
      `Audience 50% Avg (Max ${p.maxAudienceComponent})`,
      `Final Total Marks (Max ${p.maxTotal})`,
      'Percentage',
      'Formula'
    ]);
    rows.push([
      `${test.presenterRoll}`,
      test.presenterName || 'Designated Speaker',
      `${p.teacherScore}`,
      `${p.audience50Component}`,
      `${p.finalTotal}`,
      `${p.percentage}%`,
      '50% Teacher Score + 50% Class Test Average'
    ]);
    rows.push([]);
  } else {
    rows.push(['GENERAL PURPOSE TEST (ALL STUDENTS ATTEND)']);
    rows.push(['Mode', 'General Purpose Test - Standard 100% Written Test']);
    rows.push([]);
  }

  rows.push(['STUDENT MARKSHEET (ROLL 1 TO ' + test.totalStudents + ')']);
  rows.push(['Roll Number', 'Role', 'Marks Obtained', 'Max Marks', 'Percentage', 'Status', 'Submitted At']);

  for (let roll = 1; roll <= test.totalStudents; roll++) {
    const isPresenter = Boolean(p.hasPresenter && test.presenterRoll && roll === test.presenterRoll);
    const sub = test.submissions ? test.submissions[roll] : undefined;

    if (isPresenter) {
      rows.push([
        `${roll}`,
        'Seminar Speaker',
        `${p.finalTotal}`,
        `${test.totalMarks}`,
        `${p.percentage}%`,
        'Speaker Evaluated',
        'Exempt from test'
      ]);
    } else if (sub) {
      rows.push([
        `${roll}`,
        p.hasPresenter ? 'Attendee' : 'Student',
        `${sub.score}`,
        `${test.totalMarks}`,
        `${sub.percentage}%`,
        'Submitted',
        new Date(sub.submittedAt).toLocaleString()
      ]);
    } else {
      rows.push([
        `${roll}`,
        p.hasPresenter ? 'Attendee' : 'Student',
        '0',
        `${test.totalMarks}`,
        '0%',
        'Pending',
        '-'
      ]);
    }
  }

  const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `TestPortal_${test.code}_Marksheet.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export alias for backwards compatibility
export const downloadGoogleSheetsCSV = generateGoogleSheetsCSV;

export function copyTSVToClipboard(test: SeminarTest): boolean {
  try {
    const tsv = generateGoogleSheetsTSV(test);
    navigator.clipboard.writeText(tsv);
    return true;
  } catch (err) {
    console.error('Failed to copy TSV to clipboard:', err);
    return false;
  }
}

export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = (data.testCode || "Seminar Test") + " Results";
    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    sheet.clear();

    // Title & Info
    sheet.appendRow(["SEMINAR ASSESSMENT & TEST MARKSHEET"]);
    sheet.appendRow(["Program:", data.program || "-", "Course:", data.course || "-"]);
    sheet.appendRow(["Semester:", data.semester || "-", "Test Code:", data.testCode || "-"]);
    sheet.appendRow(["Topic:", data.topic || "-", "Total Marks:", data.totalMarks || "-"]);
    sheet.appendRow(["Total Enrolled:", data.totalEnrolledStudents || "-", "Audience Average:", data.audienceAverageScore || "-"]);
    sheet.appendRow([]);

    // Speaker Section
    if (data.presenter) {
      sheet.appendRow(["--- SEMINAR SPEAKER EVALUATION (50/50 FORMULA) ---"]);
      sheet.appendRow(["Speaker Roll", "Speaker Name", "Faculty 50% Score", "Audience 50% Avg", "Final Total Marks", "Max Marks"]);
      sheet.appendRow([
        data.presenter.rollNumber,
        data.presenter.name,
        data.presenter.teacherAllottedMarks50Percent,
        data.presenter.audienceAverageScore50Percent,
        data.presenter.finalTotalMarks,
        data.presenter.maxMarks
      ]);
      sheet.appendRow([]);
    } else {
      sheet.appendRow(["--- GENERAL PURPOSE TEST (ALL STUDENTS TAKE TEST) ---"]);
      sheet.appendRow([]);
    }

    // Students Roster
    sheet.appendRow(["Roll Number", "Role", "Marks Obtained", "Total Possible", "Percentage", "Status", "Submitted At"]);
    if (data.students && data.students.length > 0) {
      for (var i = 0; i < data.students.length; i++) {
        var s = data.students[i];
        sheet.appendRow([
          s.rollNumber,
          s.role,
          s.score,
          s.totalPossible,
          s.percentage + "%",
          s.status,
          s.submittedAt || "-"
        ]);
      }
    }

    // Formatting
    sheet.getRange(1, 1).setFontWeight("bold").setFontSize(14);
    sheet.autoResizeColumns(1, 7);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Marks recorded in sheet: " + sheetName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
};`;
