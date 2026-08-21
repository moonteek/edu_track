export const DEFAULT_LPL = 13;
export const LPL = 13; // for backward compatibility

export const PC = {
    // Web Development
    'HTML': { levels: 1, color: '#ff6b4a', category: 'Web Development', levelLessons: [10] },
    'CSS': { levels: 2, color: '#6b8fff', category: 'Web Development', levelLessons: [11, 13] },
    'JavaScript': { levels: 3, color: '#f5c518', category: 'Web Development' },
    'TypeScript': { levels: 1, color: '#3178c6', category: 'Web Development' },
    'React JS': { levels: 3, color: '#61dafb', category: 'Web Development' },
    'Node JS': { levels: 3, color: '#78c97a', category: 'Web Development' },
    'Web Prompt': { levels: 1, color: '#00e5ff', category: 'Web Development', levelLessons: [6] },
    // IT Kids
    'Python (Kids)': { levels: 3, color: '#306998', category: 'IT Kids' },
    'Scratch': { levels: 3, color: '#ff8f00', category: 'IT Kids' },
    // Computer Literacy
    'Computer Literacy': { levels: 2, color: '#4caf50', category: 'Computer Literacy' },
    // Graphic Design
    'Graphic Design': { levels: 6, color: '#e91e63', category: 'Graphic Design' },
    // Cyber Security
    'Cyber Security': { levels: 8, color: '#607d8b', category: 'Cyber Security' },
    // Python Backend
    'Python Backend': { levels: 9, color: '#3776ab', category: 'Python Backend' },
    // AI
    'AI': { levels: 12, color: '#9c27b0', category: 'AI' },
    // Prompt Engineering
    'Prompt Engineering': { levels: 4, color: '#00bcd4', category: 'Prompt Engineering' },
    // SMM
    'Marketing': { levels: 2, color: '#f44336', category: 'SMM' },
    'Mobilography': { levels: 2, color: '#ff9800', category: 'SMM' },
};

export const MODULES = {
    'Web Development': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React JS', 'Node JS', 'Web Prompt'],
    'IT Kids': ['Python (Kids)', 'Scratch'],
    'Computer Literacy': ['Computer Literacy'],
    'Graphic Design': ['Graphic Design'],
    'Cyber Security': ['Cyber Security'],
    'Python Backend': ['Python Backend'],
    'AI': ['AI'],
    'Prompt Engineering': ['Prompt Engineering'],
    'SMM': ['Marketing', 'Mobilography'],
};

export const VALID_LANGS = Object.keys(PC);

export function getLessonsInLevel(lang, level = 1) {
    const cfg = PC[lang];
    if (!cfg) return DEFAULT_LPL;
    if (cfg.levelLessons && cfg.levelLessons[level - 1] !== undefined) {
        return cfg.levelLessons[level - 1];
    }
    return DEFAULT_LPL;
}

export const totalLessons = (lang) => {
    const cfg = PC[lang];
    if (!cfg) return DEFAULT_LPL;
    let sum = 0;
    for (let i = 1; i <= cfg.levels; i++) {
        sum += getLessonsInLevel(lang, i);
    }
    return sum;
};

export const totalDone = (arg1, arg2, arg3) => {
    if (typeof arg1 === 'string') {
        const lang = arg1;
        const lv = arg2 || 1;
        const dim = arg3 || 0;
        let sum = 0;
        for (let i = 1; i < lv; i++) {
            sum += getLessonsInLevel(lang, i);
        }
        return sum + Math.min(dim, getLessonsInLevel(lang, lv));
    }
    // Backward-compatible fallback for totalDone(lv, dim)
    const lv = arg1 || 1;
    const dim = arg2 || 0;
    return (lv - 1) * DEFAULT_LPL + (dim || 0);
};

export const pct = (d, t) => (t ? Math.min(100, Math.round((d / t) * 100)) : 0);

export const tagCls = (lang) => {
    const map = {
        'HTML': 'HTML', 'CSS': 'CSS', 'JavaScript': 'JavaScript',
        'TypeScript': 'TypeScript',
        'React JS': 'React', 'Node JS': 'Node',
        'Web Prompt': 'WebPrompt',
        'Python (Kids)': 'Python', 'Scratch': 'Scratch',
        'Computer Literacy': 'CompLit',
        'Graphic Design': 'GraphicDesign',
        'Cyber Security': 'CyberSec',
        'Python Backend': 'PythonBack',
        'AI': 'AI',
        'Prompt Engineering': 'PromptEngineering',
        'Marketing': 'Marketing',
        'Mobilography': 'Mobilography',
    };
    return map[lang] || 'HTML';
};

/**
 * Count lesson sessions from startDateStr up to and including today,
 * following the group's Odd/Even/Every Day schedule (Sunday always skipped).
 */
export function computeElapsedLessons(startDateStr, daysSchedule) {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start > today) return 0;
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= today) {
        const dow = cursor.getDay(); // 0=Sun,1=Mon,...,6=Sat
        if (dow !== 0) {
            if (daysSchedule === 'Odd Days' && [1, 3, 5].includes(dow)) count++;
            else if (daysSchedule === 'Even Days' && [2, 4, 6].includes(dow)) count++;
            else if (daysSchedule === 'Every Day') count++;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

export const TRACK_SEQUENCES = {
    'Web Development': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React JS', 'Node JS', 'Web Prompt'],
    'IT Kids': ['Scratch', 'Python (Kids)'],
    'SMM': ['Marketing', 'Mobilography'],
};

export function getNextSubjectInTrack(currentLang) {
    for (const [, sequence] of Object.entries(TRACK_SEQUENCES)) {
        const idx = sequence.indexOf(currentLang);
        if (idx !== -1 && idx < sequence.length - 1) {
            return sequence[idx + 1];
        }
    }
    return null;
}

export function getTrackDetails(currentLang, currentLevel = 1) {
    for (const [trackName, sequence] of Object.entries(TRACK_SEQUENCES)) {
        if (sequence.includes(currentLang)) {
            let totalTrackLevels = 0;
            let currentTrackMonth = 0;
            let totalTrackLessons = 0;

            for (const lang of sequence) {
                const cfg = PC[lang] || { levels: 1 };
                const isCurrent = lang === currentLang;
                if (!isCurrent && currentTrackMonth === 0) {
                    currentTrackMonth += cfg.levels;
                } else if (isCurrent) {
                    currentTrackMonth += currentLevel;
                }
                totalTrackLevels += cfg.levels;
                totalTrackLessons += totalLessons(lang);
            }

            const nextSubject = getNextSubjectInTrack(currentLang);

            return {
                trackName,
                trackMonth: currentTrackMonth,
                totalTrackLevels,
                totalTrackLessons,
                nextSubject,
                isLastSubject: !nextSubject,
            };
        }
    }
    return null;
}

/**
 * Given a group object, compute where it should be today based purely on
 * the calendar. Returns { lang, level, doneInLevel, totalDone }.
 * Supports continuous track progression when trackMode is enabled.
 */
export function autoProgress(group) {
    const elapsed = computeElapsedLessons(group.start, group.days);
    
    // Check if group is in continuous track mode
    if (group.trackMode === true) {
        const trackCategory = PC[group.trackStartLang || group.lang]?.category;
        const sequence = TRACK_SEQUENCES[trackCategory];
        
        if (sequence) {
            const startLang = group.trackStartLang || sequence[0];
            const startIdx = sequence.indexOf(startLang);
            const activeSequence = sequence.slice(startIdx >= 0 ? startIdx : 0);
            
            let remainingLessons = elapsed;
            let curLang = activeSequence[0];
            let curLevel = 1;
            let curDoneInLevel = 0;
            let totalTrackLessons = 0;

            activeSequence.forEach(l => { totalTrackLessons += totalLessons(l); });

            for (let s = 0; s < activeSequence.length; s++) {
                const lName = activeSequence[s];
                const cfg = PC[lName] || { levels: 1 };
                curLang = lName;
                
                for (let lv = 1; lv <= cfg.levels; lv++) {
                    const lpl = getLessonsInLevel(lName, lv);
                    curLevel = lv;
                    if (remainingLessons <= lpl) {
                        curDoneInLevel = remainingLessons;
                        return {
                            lang: curLang,
                            level: curLevel,
                            doneInLevel: curDoneInLevel,
                            totalDone: totalDone(curLang, curLevel, curDoneInLevel),
                            trackDone: Math.min(totalTrackLessons, elapsed),
                            trackTotal: totalTrackLessons,
                            trackMonth: getTrackDetails(curLang, curLevel)?.trackMonth || curLevel,
                            totalTrackMonths: getTrackDetails(curLang, curLevel)?.totalTrackLevels || cfg.levels,
                            isFinished: false,
                        };
                    } else {
                        remainingLessons -= lpl;
                    }
                }
            }

            const lastLang = activeSequence[activeSequence.length - 1];
            const lastCfg = PC[lastLang] || { levels: 1 };
            const lastLpl = getLessonsInLevel(lastLang, lastCfg.levels);
            return {
                lang: lastLang,
                level: lastCfg.levels,
                doneInLevel: lastLpl,
                totalDone: totalLessons(lastLang),
                trackDone: totalTrackLessons,
                trackTotal: totalTrackLessons,
                trackMonth: getTrackDetails(lastLang, lastCfg.levels)?.totalTrackLevels || lastCfg.levels,
                totalTrackMonths: getTrackDetails(lastLang, lastCfg.levels)?.totalTrackLevels || lastCfg.levels,
                isFinished: true,
            };
        }
    }

    // Default: Single-subject auto progress across its levels
    const maxLevels = PC[group.lang]?.levels || 1;
    const tl = totalLessons(group.lang);
    if (elapsed === 0) {
        return {
            lang: group.lang,
            level: group.level,
            doneInLevel: group.doneInLevel,
            totalDone: totalDone(group.lang, group.level, group.doneInLevel),
        };
    }
    const effectiveElapsed = Math.min(tl, elapsed);
    let remaining = effectiveElapsed;
    let curLevel = 1;
    let curDoneInLevel = 0;
    for (let i = 1; i <= maxLevels; i++) {
        const lpl = getLessonsInLevel(group.lang, i);
        if (remaining <= lpl) {
            curLevel = i;
            curDoneInLevel = remaining;
            break;
        } else {
            remaining -= lpl;
            if (i === maxLevels) {
                curLevel = maxLevels;
                curDoneInLevel = lpl;
            }
        }
    }
    return {
        lang: group.lang,
        level: curLevel,
        doneInLevel: curDoneInLevel,
        totalDone: effectiveElapsed,
    };
}

/**
 * Compute the exam date (last lesson day) starting from startDateStr,
 * counting valid lesson days per the schedule for the specific level. Returns 'YYYY-MM-DD'.
 */
export function calcExamDate(startDateStr, scheduleMode, lang = 'HTML', level = 1) {
    const date = new Date(startDateStr);
    const targetLessons = getLessonsInLevel(lang, level);
    let lessonsCount = 1;
    while (lessonsCount < targetLessons) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (day === 0) continue;
        if (scheduleMode === 'Even Days' && ![2, 4, 6].includes(day)) continue;
        if (scheduleMode === 'Odd Days' && ![1, 3, 5].includes(day)) continue;
        lessonsCount++;
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export const fmtDate = (d) => {
    if (!d) return '-';
    const [y, m, dy] = d.split('-');
    return dy + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y;
};
