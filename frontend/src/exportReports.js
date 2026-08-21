import * as XLSX from 'xlsx';
import { PC, MODULES, totalLessons, totalDone, pct, autoProgress, getLessonsInLevel } from './constants';

function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Calculate weekly teaching hours for a group based on schedule and subject type.
 */
function calculateGroupWeeklyHours(group) {
    const isKids = group.lang === 'Python (Kids)' || group.lang === 'Scratch';
    const hoursPerLesson = isKids ? 1.5 : 2.0; // 90 min or 120 min
    const sessionsPerWeek = group.days === 'Every Day' ? 6 : 3; // Mon-Sat vs Odd/Even days
    return hoursPerLesson * sessionsPerWeek;
}

/**
 * Auto-fit column widths for SheetJS
 */
function autoFitColumns(aoaData) {
    const colWidths = [];
    aoaData.forEach(row => {
        row.forEach((cell, colIdx) => {
            const cellLen = cell !== null && cell !== undefined ? String(cell).length : 0;
            colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, Math.min(60, cellLen + 3));
        });
    });
    return colWidths.map(w => ({ wch: w }));
}

/**
 * Save multi-sheet or single sheet Excel Workbook (.xlsx)
 */
function saveWorkbook(sheets, filename) {
    const wb = XLSX.utils.book_new();
    sheets.forEach(({ name, data }) => {
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = autoFitColumns(data);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Excel max sheet name is 31 chars
    });
    XLSX.writeFile(wb, filename);
}

/**
 * Download CSV fallback
 */
function downloadCSV(filename, aoaData) {
    const BOM = '\uFEFF';
    const csvContent = aoaData.map(row => 
        row.map(val => {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        }).join(',')
    ).join('\r\n');

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ── DATA BUILDERS ─────────────────────────────────────────────

export function getTeacherHoursData(teachers = [], groups = []) {
    const activeGroups = groups.filter(g => !g.archived);

    const headers = [
        'Teacher Name',
        'Username',
        'Subject Categories',
        'Active Groups Count',
        'Total Students',
        'Weekly Teaching Hours (hrs/wk)',
        'Groups Summary (Group Name | Subject & Current Level | Schedule | Time Slot | Students)'
    ];

    const rows = teachers.map(teacher => {
        const tGroups = activeGroups.filter(g => g.tid === (teacher.id || teacher._id));
        const totalStudents = tGroups.reduce((sum, g) => sum + (g.students || 0), 0);
        const weeklyHours = tGroups.reduce((sum, g) => sum + calculateGroupWeeklyHours(g), 0);
        const subjects = Array.isArray(teacher.subject) ? teacher.subject.join(', ') : (teacher.subject || '-');

        const groupsSummary = tGroups.map(g => {
            const isAuto = g.autoProgress === true;
            const auto = isAuto ? autoProgress(g) : null;
            const curLevel = isAuto ? auto.level : g.level;
            const cfg = PC[g.lang] || { levels: 1 };
            const stageName = `${g.lang} (Level ${curLevel}/${cfg.levels})`;
            return `${g.group} [${stageName} | ${g.days} | ${g.startTime || '–'}-${g.endTime || '–'} | ${g.students} std]`;
        }).join('; ');

        return [
            teacher.name,
            teacher.username,
            subjects,
            tGroups.length,
            totalStudents,
            Number(weeklyHours.toFixed(1)),
            groupsSummary || 'No active groups'
        ];
    });

    const totalAllHours = activeGroups.reduce((sum, g) => sum + calculateGroupWeeklyHours(g), 0);
    const totalAllStudents = activeGroups.reduce((sum, g) => sum + (g.students || 0), 0);
    const summaryRow = [
        'TOTAL / AVERAGE',
        '',
        '',
        activeGroups.length,
        totalAllStudents,
        Number(totalAllHours.toFixed(1)),
        `Total ${teachers.length} teachers managing ${activeGroups.length} active groups`
    ];

    return {
        name: 'Teacher Hours',
        data: [headers, ...rows, summaryRow]
    };
}

export function getStudentsAndGraduationsData(groups = [], teachers = []) {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const teacherMap = Object.fromEntries((teachers || []).map(t => [t.id || t._id, t.name]));
    const activeGroups = groups.filter(g => !g.archived);

    const headers = [
        'Group Name',
        'Teacher',
        'Subject / Course',
        'Department / Category',
        'Current Stage (Subject & Level)',
        'Current Level',
        'Max Levels in Course',
        'Level Progress (Lessons Done / Total This Level)',
        'Total Course Lessons Done',
        'Total Course Lessons',
        'Overall Completion Rate (%)',
        'Schedule Mode',
        'Time Slot',
        'Cohort Start Date',
        'Next Exam Date',
        'Days Until Next Exam',
        'Final Graduation Date',
        'Days Until Graduation',
        'Status'
    ];

    const rows = activeGroups.map(g => {
        const isAuto = g.autoProgress === true;
        const auto = isAuto ? autoProgress(g) : null;
        const curLevel = isAuto ? auto.level : g.level;
        const curDoneInLevel = isAuto ? auto.doneInLevel : g.doneInLevel;
        const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
        const tl = totalLessons(g.lang);
        const progressPct = pct(done, tl);
        const cfg = PC[g.lang] || { levels: 1, category: 'General' };
        const maxLevelLessons = getLessonsInLevel(g.lang, curLevel);

        const currentStageName = `${g.lang} - Level ${curLevel} of ${cfg.levels}`;
        const levelProgressText = `${curDoneInLevel} / ${maxLevelLessons} lessons`;

        const nextExamDateStr = auto?.currentExamDate || g.exam;
        const finalGradDateStr = auto?.finalExamDate || g.exam;

        let daysUntilNextExam = 'N/A';
        let daysUntilGrad = 'N/A';
        let status = 'In Progress';

        if (nextExamDateStr) {
            const examDate = new Date(nextExamDateStr);
            examDate.setHours(0, 0, 0, 0);
            const diffTime = examDate.getTime() - todayDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysUntilNextExam = diffDays >= 0 ? `${diffDays} days` : `Passed (${Math.abs(diffDays)}d ago)`;

            if (progressPct === 100) {
                status = 'Graduated / Completed';
            } else if (diffDays <= 7 && diffDays >= 0) {
                status = 'Next Exam Soon (<7d)';
            } else if (diffDays < 0) {
                status = 'Level Exam Passed';
            }
        }

        if (finalGradDateStr) {
            const gradDate = new Date(finalGradDateStr);
            gradDate.setHours(0, 0, 0, 0);
            const diffTime = gradDate.getTime() - todayDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysUntilGrad = diffDays >= 0 ? `${diffDays} days` : `Graduated (${Math.abs(diffDays)}d ago)`;
        }

        return [
            g.group,
            teacherMap[g.tid] || 'Unknown Teacher',
            g.lang,
            cfg.category || '-',
            currentStageName,
            curLevel,
            cfg.levels || 1,
            levelProgressText,
            done,
            tl,
            `${progressPct}%`,
            g.days || 'Every Day',
            `${g.startTime || '–'} - ${g.endTime || '–'}`,
            g.start || '-',
            nextExamDateStr || '-',
            daysUntilNextExam,
            finalGradDateStr || '-',
            daysUntilGrad,
            status
        ];
    });

    const totalStudents = activeGroups.reduce((s, g) => s + (g.students || 0), 0);
    const avgCompletion = activeGroups.length
        ? Math.round(activeGroups.reduce((s, g) => {
            const isAuto = g.autoProgress === true;
            const auto = isAuto ? autoProgress(g) : null;
            const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
            return s + pct(done, totalLessons(g.lang));
        }, 0) / activeGroups.length)
        : 0;

    const summaryRow = [
        'TOTAL SUMMARY',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totalStudents,
        `${avgCompletion}% Avg`,
        '',
        '',
        '',
        '',
        '',
        `${activeGroups.length} Active Groups`
    ];

    return {
        name: 'Students & Graduations',
        data: [headers, ...rows, summaryRow]
    };
}

export function getCourseCompletionData(groups = []) {
    const activeGroups = groups.filter(g => !g.archived);

    const headers = [
        'Department / Category',
        'Course / Subject',
        'Course Levels (Months)',
        'Total Course Lessons',
        'Active Groups Count',
        'Active Students Count',
        'Current Level Breakdown',
        'Average Course Progress (%)',
        'Performance Status'
    ];

    const rows = [];

    Object.entries(MODULES).forEach(([category, courses]) => {
        courses.forEach(lang => {
            const gs = activeGroups.filter(g => g.lang === lang);
            const totalStudents = gs.reduce((s, g) => s + (g.students || 0), 0);
            const cfg = PC[lang] || { levels: 1 };
            const tl = totalLessons(lang);

            const avgPct = gs.length
                ? Math.round(gs.reduce((s, g) => {
                    const isAuto = g.autoProgress === true;
                    const auto = isAuto ? autoProgress(g) : null;
                    const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
                    return s + pct(done, tl);
                }, 0) / gs.length)
                : 0;

            // Compute level breakdown (e.g., "1 in Lv1, 2 in Lv2")
            const levelCounts = {};
            gs.forEach(g => {
                const isAuto = g.autoProgress === true;
                const auto = isAuto ? autoProgress(g) : null;
                const curLevel = isAuto ? auto.level : g.level;
                levelCounts[curLevel] = (levelCounts[curLevel] || 0) + 1;
            });
            const breakdownStr = gs.length
                ? Object.entries(levelCounts).map(([lv, count]) => `${count} in Lv${lv}`).join(', ')
                : 'None';

            let perfLevel = 'No Active Groups';
            if (gs.length > 0) {
                if (avgPct >= 80) perfLevel = 'High (Near Completion)';
                else if (avgPct >= 40) perfLevel = 'Moderate (Mid-Course)';
                else perfLevel = 'Early Stage (0-39%)';
            }

            rows.push([
                category,
                lang,
                `${cfg.levels || 1} Levels (${cfg.levels || 1} Mos)`,
                `${tl} lessons`,
                gs.length,
                totalStudents,
                breakdownStr,
                gs.length ? `${avgPct}%` : '0%',
                perfLevel
            ]);
        });
    });

    const totalStudents = activeGroups.reduce((s, g) => s + (g.students || 0), 0);
    const overallAvg = activeGroups.length
        ? Math.round(activeGroups.reduce((s, g) => {
            const isAuto = g.autoProgress === true;
            const auto = isAuto ? autoProgress(g) : null;
            const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
            return s + pct(done, totalLessons(g.lang));
        }, 0) / activeGroups.length)
        : 0;

    const summaryRow = [
        'ALL PLATFORM COURSES',
        '',
        '',
        '',
        activeGroups.length,
        totalStudents,
        '',
        `${overallAvg}% Overall`,
        'Platform Wide Summary'
    ];

    return {
        name: 'Course Completion',
        data: [headers, ...rows, summaryRow]
    };
}

// ── EXPORT COMMANDS (.xlsx & .csv) ────────────────────────────

export function exportTeacherHoursReport(teachers = [], groups = [], format = 'xlsx') {
    const today = getTodayStr();
    const sheet = getTeacherHoursData(teachers, groups);
    const filename = `EduTrack_Teacher_Hours_${today}`;

    if (format === 'xlsx') {
        saveWorkbook([sheet], `${filename}.xlsx`);
    } else {
        downloadCSV(`${filename}.csv`, sheet.data);
    }
}

export function exportStudentsAndGraduationsReport(groups = [], teachers = [], format = 'xlsx') {
    const today = getTodayStr();
    const sheet = getStudentsAndGraduationsData(groups, teachers);
    const filename = `EduTrack_Students_Graduations_${today}`;

    if (format === 'xlsx') {
        saveWorkbook([sheet], `${filename}.xlsx`);
    } else {
        downloadCSV(`${filename}.csv`, sheet.data);
    }
}

export function exportCourseCompletionReport(groups = [], format = 'xlsx') {
    const today = getTodayStr();
    const sheet = getCourseCompletionData(groups);
    const filename = `EduTrack_Course_Completion_Rates_${today}`;

    if (format === 'xlsx') {
        saveWorkbook([sheet], `${filename}.xlsx`);
    } else {
        downloadCSV(`${filename}.csv`, sheet.data);
    }
}

/**
 * Multi-Sheet Master Workbook (.xlsx) containing all 3 reports in 1 single file!
 */
export function exportMasterExcelReport(teachers = [], groups = []) {
    const today = getTodayStr();
    const sheet1 = getTeacherHoursData(teachers, groups);
    const sheet2 = getStudentsAndGraduationsData(groups, teachers);
    const sheet3 = getCourseCompletionData(groups);

    saveWorkbook([sheet1, sheet2, sheet3], `EduTrack_Master_Report_${today}.xlsx`);
}

