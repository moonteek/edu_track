import { PC, MODULES, totalLessons, totalDone, pct, autoProgress } from './constants';

/**
 * Downloads a string as a CSV file in the browser with UTF-8 BOM so Excel opens it with proper encoding.
 */
function downloadCSV(filename, csvContent) {
    const BOM = '\uFEFF';
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

function escapeCSV(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

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
 * REPORT 1: Teacher Hours & Group List
 */
export function exportTeacherHoursReport(teachers = [], groups = []) {
    const today = getTodayStr();
    const activeGroups = groups.filter(g => !g.archived);

    const headers = [
        'Teacher Name',
        'Username',
        'Subject Categories',
        'Active Groups Count',
        'Total Students',
        'Weekly Teaching Hours (hrs/wk)',
        'Groups Summary (Group | Subject | Schedule | Time | Students)'
    ];

    const rows = teachers.map(teacher => {
        const tGroups = activeGroups.filter(g => g.tid === (teacher.id || teacher._id));
        const totalStudents = tGroups.reduce((sum, g) => sum + (g.students || 0), 0);
        const weeklyHours = tGroups.reduce((sum, g) => sum + calculateGroupWeeklyHours(g), 0);
        const subjects = Array.isArray(teacher.subject) ? teacher.subject.join(', ') : (teacher.subject || '-');

        const groupsSummary = tGroups.map(g => 
            `${g.group} [${g.lang}, ${g.days}, ${g.startTime || '–'}-${g.endTime || '–'}, ${g.students} std]`
        ).join('; ');

        return [
            escapeCSV(teacher.name),
            escapeCSV(teacher.username),
            escapeCSV(subjects),
            tGroups.length,
            totalStudents,
            weeklyHours.toFixed(1),
            escapeCSV(groupsSummary || 'No active groups')
        ].join(',');
    });

    // Total summary row
    const totalAllHours = activeGroups.reduce((sum, g) => sum + calculateGroupWeeklyHours(g), 0);
    const totalAllStudents = activeGroups.reduce((sum, g) => sum + (g.students || 0), 0);
    const summaryRow = [
        escapeCSV('TOTAL / AVERAGE'),
        '""',
        '""',
        activeGroups.length,
        totalAllStudents,
        totalAllHours.toFixed(1),
        escapeCSV(`Total ${teachers.length} teachers managing ${activeGroups.length} active groups`)
    ].join(',');

    const csvContent = [headers.join(','), ...rows, summaryRow].join('\r\n');
    downloadCSV(`EduTrack_Teacher_Hours_${today}.csv`, csvContent);
}

/**
 * REPORT 2: Active Students & Upcoming Graduations
 */
export function exportStudentsAndGraduationsReport(groups = [], teachers = []) {
    const today = getTodayStr();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const teacherMap = Object.fromEntries((teachers || []).map(t => [t.id || t._id, t.name]));
    const activeGroups = groups.filter(g => !g.archived);

    const headers = [
        'Group Name',
        'Teacher',
        'Course / Language',
        'Category',
        'Students Count',
        'Current Level',
        'Max Levels',
        'Lessons Completed',
        'Total Course Lessons',
        'Completion Rate (%)',
        'Schedule Mode',
        'Time Slot',
        'Start Date',
        'Exam Date',
        'Days Until Exam',
        'Status'
    ];

    const rows = activeGroups.map(g => {
        const isAuto = g.autoProgress === true;
        const auto = isAuto ? autoProgress(g) : null;
        const curLevel = isAuto ? auto.level : g.level;
        const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
        const tl = totalLessons(g.lang);
        const progressPct = pct(done, tl);
        const cfg = PC[g.lang] || { levels: 1, category: 'General' };

        let daysRemaining = 'N/A';
        let status = 'In Progress';

        if (g.exam) {
            const examDate = new Date(g.exam);
            examDate.setHours(0, 0, 0, 0);
            const diffTime = examDate.getTime() - todayDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysRemaining = diffDays >= 0 ? `${diffDays} days` : `Passed (${Math.abs(diffDays)}d ago)`;

            if (progressPct === 100) {
                status = 'Graduated / Completed';
            } else if (diffDays <= 7 && diffDays >= 0) {
                status = 'Graduating Soon (Exam in <7d)';
            } else if (diffDays < 0) {
                status = 'Exam Date Passed';
            }
        }

        return [
            escapeCSV(g.group),
            escapeCSV(teacherMap[g.tid] || 'Unknown Teacher'),
            escapeCSV(g.lang),
            escapeCSV(cfg.category || '-'),
            g.students || 0,
            curLevel,
            cfg.levels || 1,
            done,
            tl,
            `${progressPct}%`,
            escapeCSV(g.days || 'Every Day'),
            escapeCSV(`${g.startTime || '–'} - ${g.endTime || '–'}`),
            escapeCSV(g.start || '-'),
            escapeCSV(g.exam || '-'),
            escapeCSV(daysRemaining),
            escapeCSV(status)
        ].join(',');
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
        escapeCSV('TOTAL SUMMARY'),
        '""',
        '""',
        '""',
        totalStudents,
        '""',
        '""',
        '""',
        '""',
        `${avgCompletion}% Avg`,
        '""',
        '""',
        '""',
        '""',
        '""',
        escapeCSV(`${activeGroups.length} Active Groups`)
    ].join(',');

    const csvContent = [headers.join(','), ...rows, summaryRow].join('\r\n');
    downloadCSV(`EduTrack_Students_Graduations_${today}.csv`, csvContent);
}

/**
 * REPORT 3: Course Completion Rates & Platform Performance
 */
export function exportCourseCompletionReport(groups = []) {
    const today = getTodayStr();
    const activeGroups = groups.filter(g => !g.archived);

    const headers = [
        'Category / Department',
        'Course / Module',
        'Course Levels (Months)',
        'Total Course Lessons',
        'Active Groups',
        'Active Students',
        'Average Progress (%)',
        'Performance Level'
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

            let perfLevel = 'No Active Groups';
            if (gs.length > 0) {
                if (avgPct >= 80) perfLevel = 'High (Near Completion)';
                else if (avgPct >= 40) perfLevel = 'Moderate (Mid-Course)';
                else perfLevel = 'Early Stage (0-39%)';
            }

            rows.push([
                escapeCSV(category),
                escapeCSV(lang),
                cfg.levels || 1,
                tl,
                gs.length,
                totalStudents,
                gs.length ? `${avgPct}%` : '0%',
                escapeCSV(perfLevel)
            ].join(','));
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
        escapeCSV('ALL PLATFORM COURSES'),
        '""',
        '""',
        '""',
        activeGroups.length,
        totalStudents,
        `${overallAvg}% Overall`,
        escapeCSV('Platform Wide Summary')
    ].join(',');

    const csvContent = [headers.join(','), ...rows, summaryRow].join('\r\n');
    downloadCSV(`EduTrack_Course_Completion_Rates_${today}.csv`, csvContent);
}
