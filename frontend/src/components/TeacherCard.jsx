import { PC, LPL, totalDone, totalLessons, pct, tagCls } from '../constants';

export default function TeacherCard({ teacher, groups, index = 0, onEdit, onDelete, onViewSchedule, onAddGroup }) {
    const ts = groups.reduce((a, g) => a + g.students, 0);
    const ap = groups.length
        ? Math.round(groups.reduce((a, g) => a + pct(totalDone(g.level, g.doneInLevel), totalLessons(g.lang)), 0) / groups.length)
        : 0;

    return (
        <div className="teacher-card" style={{ animationDelay: index * 0.05 + 's' }}>
            <div className="tc-head">
                <div className="tc-avatar">{teacher.name.charAt(0)}</div>
                <div>
                    <div className="tc-name">{teacher.name}</div>
                    <div style={{ margin: '3px 0 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(Array.isArray(teacher.subject) ? teacher.subject : [teacher.subject]).map(s => (
                            <span key={s} style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--fm)', letterSpacing: '.5px', background: 'rgba(245,197,24,.12)', color: 'var(--yellow)', border: '1px solid rgba(245,197,24,.25)' }}>{s}</span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="tc-body">
                <div className="tc-stats">
                    <div className="tc-stat"><div className="tc-stat-num">{groups.length}</div><div className="tc-stat-lbl">Groups</div></div>
                    <div className="tc-stat"><div className="tc-stat-num">{ts}</div><div className="tc-stat-lbl">Students</div></div>
                    <div className="tc-stat"><div className="tc-stat-num">{ap}%</div><div className="tc-stat-lbl">Avg Prog</div></div>
                </div>

                <div style={{ fontSize: '10px', color: 'var(--gray)', fontFamily: 'var(--fm)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Groups</div>
                <div className="tc-groups-list">
                    {groups.length ? groups.map((g) => {
                        const p = pct(totalDone(g.level, g.doneInLevel), totalLessons(g.lang));
                        const cfg = PC[g.lang] || { levels: 1 };
                        return (
                            <div key={g.id} className="tc-group-row">
                                <span className={'tag tag-' + tagCls(g.lang)} style={{ fontSize: '10px' }}>{g.lang}</span>
                                <span className="tc-group-name">{g.group}</span>
                                <span style={{ fontSize: '10px', color: 'var(--gray)', fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>Lv{g.level}/{cfg.levels}</span>
                                <div className="tc-group-prog">
                                    <div className="tc-mini-track"><div className="tc-mini-fill" style={{ width: p + '%' }}></div></div>
                                    <span className="tc-group-pct">{p}%</span>
                                </div>
                            </div>
                        );
                    }) : (
                        <div style={{ fontSize: '13px', color: 'var(--gray)', textAlign: 'center', padding: '16px', fontFamily: 'var(--fm)' }}>No groups assigned yet</div>
                    )}
                </div>
            </div>
            <div className="tc-actions">
                {onViewSchedule && <button className="btn-sm" style={{ background: 'var(--darker)', color: 'var(--white)' }} onClick={() => onViewSchedule(teacher)}>Schedule</button>}
                {onAddGroup && <button className="btn-sm" style={{ background: 'var(--yellow)', color: 'var(--black)', fontWeight: 600 }} onClick={() => onAddGroup(teacher)}>+ Group</button>}
                <button className="btn-sm btn-sm-yellow" onClick={() => onEdit(teacher)}>Edit</button>
                <button className="btn-sm btn-sm-red" onClick={() => onDelete(teacher, groups.length)}>Delete</button>
            </div>
        </div>
    );
}
