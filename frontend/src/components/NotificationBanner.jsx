import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { totalDone, totalLessons, pct, autoProgress } from '../constants';

const DISMISS_KEY = 'nearComplete_dismissed';
function loadDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
}
function saveDismissed(map) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch { }
}

function getGroupPct(g) {
    const isAuto = g.autoProgress === true;
    const auto = isAuto ? autoProgress(g) : null;
    const done = isAuto ? auto.totalDone : totalDone(g.lang, g.level, g.doneInLevel);
    return pct(done, totalLessons(g.lang));
}

export default function NotificationBell({ token, onGoToGroups }) {
    const [allNear, setAllNear] = useState([]);
    const [dismissed, setDismissed] = useState(loadDismissed);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const load = useCallback(async () => {
        if (!token) return;
        try {
            const groups = await api('GET', '/api/groups', null, token);
            setAllNear(groups.filter(g => getGroupPct(g) >= 95));
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

    const visible = allNear.filter(g => {
        const id = g.id || g._id;
        const p = getGroupPct(g);
        return !dismissed[`${id}_${p}`];
    });

    const count = visible.length;

    function dismiss(group) {
        const id = group.id || group._id;
        const p = getGroupPct(group);
        const next = { ...dismissed, [`${id}_${p}`]: true };
        setDismissed(next); saveDismissed(next);
    }

    function dismissAll() {
        const next = { ...dismissed };
        visible.forEach(g => {
            const id = g.id || g._id;
            const p = getGroupPct(g);
            next[`${id}_${p}`] = true;
        });
        setDismissed(next); saveDismissed(next);
    }

    return (
        <div className="notif-bell-wrap" ref={ref}>
            <button
                className={`notif-bell-btn${open ? ' open' : ''}`}
                onClick={() => setOpen(o => !o)}
                title="Group notifications"
            >
                {/* Bell SVG */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {count > 0 && (
                    <span className="notif-badge">{count > 9 ? '9+' : count}</span>
                )}
            </button>

            {open && (
                <div className="notif-dropdown">
                    <div className="notif-drop-header">
                        <span className="notif-drop-title">
                            {count > 0
                                ? `${count} group${count > 1 ? 's' : ''} nearly finished`
                                : 'No pending notifications'}
                        </span>
                        {count > 0 && (
                            <button className="notif-btn-link" onClick={dismissAll}>
                                Clear all
                            </button>
                        )}
                    </div>

                    {count === 0 ? (
                        <div className="notif-empty">
                            <span style={{ fontSize: 28 }}>✓</span>
                            <span>All groups are on track</span>
                        </div>
                    ) : (
                        <div className="notif-drop-list">
                            {visible.map(g => {
                                const id = g.id || g._id;
                                const p = getGroupPct(g);
                                const done = p >= 100;
                                return (
                                    <div key={id} className={`notif-drop-item${done ? ' done' : ''}`}>
                                        <div className={`notif-pct-badge${done ? ' done' : ''}`}>{p}%</div>
                                        <div className="notif-drop-info">
                                            <div className="notif-card-name">{g.group}</div>
                                            <div className="notif-card-meta">
                                                {g.lang} &nbsp;·&nbsp; {g.students} students
                                                {done
                                                    ? <span className="notif-label-done">✓ Complete — delete class</span>
                                                    : <span className="notif-label-near">Almost done</span>
                                                }
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <button
                                                className="notif-goto-btn"
                                                onClick={() => { onGoToGroups && onGoToGroups(); setOpen(false); }}
                                            >Manage</button>
                                            <button className="notif-dismiss-btn" onClick={() => dismiss(g)}>✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
