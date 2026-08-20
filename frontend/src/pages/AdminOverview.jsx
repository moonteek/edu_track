import { useState, useEffect } from 'react';
import { api } from '../api';
import { PC, LPL, totalDone, totalLessons, pct, tagCls, MODULES } from '../constants';
import { useToast } from '../components/Toast';
import Skeleton from '../components/Skeleton';
import ExportReportsButton from '../components/ExportReportsButton';

export default function AdminOverview({ token, onLogout }) {
    const [stats, setStats] = useState(null);
    const showToast = useToast();

    useEffect(() => { loadStats(); }, []);

    async function loadStats() {
        try {
            setStats(null);
            const s = await api('GET', '/api/stats', null, token, onLogout);
            setStats(s);
        } catch (err) {
            showToast('Failed to load stats: ' + err.message, true);
        }
    }

    if (!stats) return <div className="panel-body"><Skeleton /></div>;

    // Build per-category aggregation from byLang data
    const langMap = Object.fromEntries(stats.byLang.map(l => [l.lang, l]));
    const categoryStats = Object.entries(MODULES).map(([cat, courses]) => {
        const activeCourses = courses.filter(c => langMap[c]?.groups > 0);
        const totGroups = activeCourses.reduce((s, c) => s + (langMap[c]?.groups || 0), 0);
        const totStudents = activeCourses.reduce((s, c) => s + (langMap[c]?.students || 0), 0);
        const avgPct = activeCourses.length
            ? Math.round(activeCourses.reduce((s, c) => s + (langMap[c]?.avgPct || 0), 0) / activeCourses.length)
            : 0;
        return { cat, activeCourses, totGroups, totStudents, avgPct };
    }).filter(c => c.totGroups > 0);

    const activeLangs = stats.byLang.filter(l => l.groups > 0);

    return (
        <div className="panel-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span className="slabel" style={{ margin: 0 }}>Platform Stats</span>
                <ExportReportsButton token={token} onLogout={onLogout} />
            </div>
            <div className="stats-row">
                <div className="stat-card"><div className="stat-card-num">{stats.totalGroups}</div><div className="stat-card-lbl">Groups</div></div>
                <div className="stat-card"><div className="stat-card-num">{stats.totalTeachers}</div><div className="stat-card-lbl">Teachers</div></div>
                <div className="stat-card"><div className="stat-card-num">{stats.totalStudents}</div><div className="stat-card-lbl">Students</div></div>
                <div className="stat-card"><div className="stat-card-num">{stats.avgProgress}%</div><div className="stat-card-lbl">Avg Progress</div></div>
                <div className="stat-card"><div className="stat-card-num">{categoryStats.length}</div><div className="stat-card-lbl">Categories</div></div>
                <div className="stat-card"><div className="stat-card-num">{activeLangs.length}</div><div className="stat-card-lbl">Courses</div></div>
            </div>

            <span className="slabel">Progress by Category</span>
            {categoryStats.length === 0 ? (
                <div className="empty-state"><div className="empty-line">NO DATA</div><p>No groups yet.</p></div>
            ) : (
                categoryStats.map(({ cat, activeCourses, totGroups, totStudents, avgPct }) => (
                    <div key={cat} style={{ background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '18px 24px', marginBottom: '14px', transition: 'border-color .2s' }}>
                        {/* Category header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <span style={{ fontFamily: 'var(--fd)', fontSize: '15px', color: 'var(--white)', letterSpacing: '1px' }}>{cat}</span>
                                <span style={{ fontFamily: 'var(--fm)', fontSize: '11px', color: 'var(--gray)' }}>
                                    {totGroups} group{totGroups !== 1 ? 's' : ''} &nbsp;·&nbsp; {totStudents} students
                                </span>
                            </div>
                            <span style={{ fontFamily: 'var(--fm)', fontSize: '16px', color: 'var(--yellow)', fontWeight: 700 }}>{avgPct}%</span>
                        </div>
                        {/* Category progress bar */}
                        <div style={{ background: 'var(--dark2)', borderRadius: '100px', height: '6px', overflow: 'hidden', marginBottom: '14px' }}>
                            <div style={{ width: avgPct + '%', height: '100%', background: 'var(--yellow)', borderRadius: '100px', transition: 'width .6s ease' }}></div>
                        </div>
                        {/* Per-course breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {activeCourses.map(lang => {
                                const l = langMap[lang];
                                const cfg = PC[lang] || { levels: 1 };
                                return (
                                    <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <span className={'tag tag-' + tagCls(lang)} style={{ fontSize: '11px', padding: '4px 10px', minWidth: '120px', textAlign: 'center' }}>{lang}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--gl)', fontFamily: 'var(--fm)' }}>
                                                    {l.groups} group{l.groups > 1 ? 's' : ''} &nbsp;·&nbsp; {l.students} students &nbsp;·&nbsp; {cfg.levels} month{cfg.levels > 1 ? 's' : ''}
                                                </span>
                                                <span style={{ fontFamily: 'var(--fm)', fontSize: '12px', color: PC[lang]?.color || 'var(--yellow)', fontWeight: 700 }}>{l.avgPct}%</span>
                                            </div>
                                            <div style={{ background: 'var(--dark3)', borderRadius: '100px', height: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: l.avgPct + '%', height: '100%', background: PC[lang]?.color || 'var(--yellow)', borderRadius: '100px' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
