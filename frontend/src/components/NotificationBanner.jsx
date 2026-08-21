import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { totalDone, totalLessons, pct, autoProgress, fmtDate } from '../constants';

const DISMISS_KEY = 'admin_notifs_dismissed_v2';
function loadDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
}
function saveDismissed(map) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch { }
}

export default function NotificationBell({ token, onGoToGroups }) {
    const [groups, setGroups] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [dismissed, setDismissed] = useState(loadDismissed);
    const [filterType, setFilterType] = useState('all'); // 'all' | 'exam' | 'completion'
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const load = useCallback(async () => {
        if (!token) return;
        try {
            const [gs, ts] = await Promise.all([
                api('GET', '/api/groups', null, token),
                api('GET', '/api/teachers', null, token).catch(() => []),
            ]);
            setGroups(gs || []);
            setTeachers(ts || []);
        } catch { }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    // Close dropdown on outside click
    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const teacherMap = (teachers || []).reduce((acc, t) => {
        acc[t.id || t._id] = t.name;
        return acc;
    }, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build notifications list
    const notifications = [];

    (groups || []).forEach(g => {
        const id = g.id || g._id;
        const isAuto = g.autoProgress === true;
        const auto = isAuto ? autoProgress(g) : null;
        const curLevel = isAuto ? auto.level : g.level;
        const curLang = isAuto ? auto.lang : g.lang;
        const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
        const progressPct = pct(done, totalLessons(g.lang));

        // 1. Exam Notifications (Exam within <= 7 days or today or up to 2 days passed)
        const examDateStr = auto?.currentExamDate || g.exam;
        if (examDateStr) {
            const parts = examDateStr.split('-').map(Number);
            if (parts.length >= 3 && !isNaN(parts[0])) {
                const exDate = new Date(parts[0], parts[1] - 1, parts[2]);
                exDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((exDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays <= 7) {
                    const notifId = `${id}_exam_${examDateStr}`;
                    let title = '';
                    let urgency = 1;
                    let badgeText = '';
                    let itemClass = 'exam-soon';

                    if (diffDays === 0) {
                        title = 'Exam Today!';
                        urgency = 4;
                        badgeText = 'TODAY';
                        itemClass = 'exam-today';
                    } else if (diffDays === 1) {
                        title = 'Exam Tomorrow!';
                        urgency = 3;
                        badgeText = '1 DAY';
                        itemClass = 'exam-tomorrow';
                    } else {
                        title = `Exam in ${diffDays} days`;
                        urgency = 2;
                        badgeText = `${diffDays}d`;
                        itemClass = 'exam-soon';
                    }

                    notifications.push({
                        id: notifId,
                        groupObj: g,
                        groupId: id,
                        type: 'exam',
                        urgency,
                        title,
                        badgeText,
                        itemClass,
                        groupName: g.group,
                        stage: `${curLang} (Lv${curLevel})`,
                        teacherName: teacherMap[g.tid] || 'Unknown Teacher',
                        dateStr: fmtDate(examDateStr),
                        meta: `${g.days || 'Odd Days'} · ${g.startTime || '–'}`
                    });
                }
            }
        }

        // 2. Completion Notifications (>= 95%)
        if (progressPct >= 95) {
            const notifId = `${id}_comp_${progressPct}`;
            const isFinished = progressPct >= 100;
            notifications.push({
                id: notifId,
                groupObj: g,
                groupId: id,
                type: 'completion',
                urgency: isFinished ? 2 : 1,
                title: isFinished ? 'Course Completed' : 'Almost Completed',
                badgeText: `${progressPct}%`,
                itemClass: isFinished ? 'done' : 'near',
                groupName: g.group,
                stage: `${curLang} (Lv${curLevel})`,
                teacherName: teacherMap[g.tid] || 'Unknown Teacher',
                dateStr: `${done}/${totalLessons(g.lang)} lessons`,
                meta: `${g.students || 0} students · ${progressPct}% done`
            });
        }
    });

    // Filter out dismissed
    const visible = notifications
        .filter(n => !dismissed[n.id])
        .sort((a, b) => b.urgency - a.urgency);

    const examCount = visible.filter(n => n.type === 'exam').length;
    const compCount = visible.filter(n => n.type === 'completion').length;
    const count = visible.length;

    const filteredVisible = visible.filter(n => {
        if (filterType === 'exam') return n.type === 'exam';
        if (filterType === 'completion') return n.type === 'completion';
        return true;
    });

    function dismiss(notifId) {
        const next = { ...dismissed, [notifId]: true };
        setDismissed(next);
        saveDismissed(next);
    }

    function dismissAll() {
        const next = { ...dismissed };
        visible.forEach(n => { next[n.id] = true; });
        setDismissed(next);
        saveDismissed(next);
    }

    return (
        <div className="notif-bell-wrap" ref={ref}>
            <button
                className={`notif-bell-btn${open ? ' open' : ''}`}
                onClick={() => setOpen(o => !o)}
                title="Notifications (Upcoming exams & completions)"
            >
                {/* Bell SVG */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {count > 0 && (
                    <span className={`notif-badge${examCount > 0 ? ' has-exams' : ''}`}>
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="notif-dropdown" style={{ width: '400px' }}>
                    <div className="notif-drop-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="notif-drop-title">
                                {count > 0
                                    ? `${count} active notification${count > 1 ? 's' : ''}`
                                    : 'No pending notifications'}
                            </span>
                        </div>
                        {count > 0 && (
                            <button className="notif-btn-link" onClick={dismissAll}>
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    {count > 0 && (
                        <div style={{
                            display: 'flex',
                            padding: '6px 10px',
                            background: 'rgba(255,255,255,0.02)',
                            borderBottom: '1px solid var(--border)',
                            gap: '6px',
                            fontSize: '11px',
                            fontFamily: 'var(--fm)'
                        }}>
                            <button
                                onClick={() => setFilterType('all')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: filterType === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: filterType === 'all' ? '#fff' : 'var(--muted)',
                                    fontWeight: 600
                                }}
                            >
                                All ({count})
                            </button>
                            <button
                                onClick={() => setFilterType('exam')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: filterType === 'exam' ? 'rgba(244,67,54,0.15)' : 'transparent',
                                    color: filterType === 'exam' ? 'var(--red)' : 'var(--muted)',
                                    fontWeight: 600
                                }}
                            >
                                📅 Exams ({examCount})
                            </button>
                            <button
                                onClick={() => setFilterType('completion')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: filterType === 'completion' ? 'rgba(245,197,24,0.15)' : 'transparent',
                                    color: filterType === 'completion' ? 'var(--yellow)' : 'var(--muted)',
                                    fontWeight: 600
                                }}
                            >
                                🎓 Completed ({compCount})
                            </button>
                        </div>
                    )}

                    {count === 0 ? (
                        <div className="notif-empty">
                            <span style={{ fontSize: 28 }}>✓</span>
                            <span>All groups and exams are on track</span>
                        </div>
                    ) : filteredVisible.length === 0 ? (
                        <div className="notif-empty">
                            <span>No notifications in this category</span>
                        </div>
                    ) : (
                        <div className="notif-drop-list">
                            {filteredVisible.map(n => (
                                <div key={n.id} className={`notif-drop-item ${n.itemClass}`}>
                                    <div className={`notif-pct-badge ${n.itemClass}`}>
                                        {n.badgeText}
                                    </div>
                                    <div className="notif-drop-info">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                            <div className="notif-card-name">{n.groupName}</div>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                color: n.type === 'exam' ? (n.urgency >= 3 ? 'var(--red)' : 'var(--yellow)') : 'var(--green)',
                                                fontFamily: 'var(--fm)'
                                            }}>
                                                {n.title}
                                            </span>
                                        </div>
                                        <div className="notif-card-meta" style={{ marginTop: '2px' }}>
                                            <span>{n.stage}</span> &nbsp;·&nbsp; <span>{n.teacherName}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--fm)' }}>
                                            {n.type === 'exam' ? `Exam: ${n.dateStr}` : n.dateStr} &nbsp;·&nbsp; {n.meta}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                        <button
                                            className="notif-goto-btn"
                                            onClick={() => { onGoToGroups && onGoToGroups(); setOpen(false); }}
                                            title="View in Groups tab"
                                        >View</button>
                                        <button className="notif-dismiss-btn" onClick={() => dismiss(n.id)} title="Dismiss">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
