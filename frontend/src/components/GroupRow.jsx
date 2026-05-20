import { PC, totalDone, totalLessons, tagCls, fmtDate } from '../constants';
import LevelBar from './LevelBar';

export default function GroupRow({ group, onEdit, onDelete, onArchive, selected, onSelect }) {
    const cfg = PC[group.lang] || { levels: 1 };
    const done = totalDone(group.level, group.doneInLevel);
    const tl = totalLessons(group.lang);

    return (
        <tr className={selected ? 'selected-row' : ''}>
            {onSelect !== undefined && (
                <td style={{ textAlign: 'center' }}>
                    <input
                        type="checkbox"
                        checked={selected || false}
                        onChange={() => onSelect(group.id || group._id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', opacity: 0.8 }}
                    />
                </td>
            )}
            <td className="td-w">{group.group}</td>
            <td><span className={'tag tag-' + tagCls(group.lang)}>{group.lang}</span></td>
            <td>
                <span style={{ fontFamily: 'var(--fm)', fontSize: '11px', color: 'var(--yellow)', background: 'var(--yglow)', padding: '4px 12px', borderRadius: '100px', border: '1px solid var(--yborder)', whiteSpace: 'nowrap' }}>
                    Lv {group.level}/{cfg.levels}
                </span>
            </td>
            <td className="td-m">{group.startTime || '–'} – {group.endTime || '–'}</td>
            <td className="td-m">{group.days || 'Every Day'}</td>
            <td>{fmtDate(group.start)}</td>
            <td>{fmtDate(group.exam)}</td>
            <td className="td-n">{group.students}</td>
            <td className="td-m">{done}/{tl}</td>
            <td><LevelBar group={group} mode="table" /></td>
            {(onEdit || onDelete || onArchive) && (
                <td style={{ textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end', height: '100%', alignItems: 'center' }}>
                    {onEdit && (
                        <button
                            onClick={() => onEdit(group)}
                            title="Edit Group"
                            style={{
                                color: 'var(--primary)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '6px',
                                opacity: 0.6,
                                transition: 'opacity 0.2s, background 0.2s',
                                borderRadius: '6px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    )}
                    {onArchive && (
                        <button
                            onClick={() => onArchive(group)}
                            title={group.archived ? "Restore Group" : "Archive Group"}
                            style={{
                                color: group.archived ? 'var(--yellow)' : 'var(--gray)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '6px',
                                opacity: 0.6,
                                transition: 'opacity 0.2s, background 0.2s',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = 1;
                                e.currentTarget.style.background = group.archived ? 'rgba(245,197,24,0.1)' : 'rgba(255,255,255,0.08)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = 0.6;
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            {group.archived ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                                    <rect x="1" y="3" width="22" height="5"></rect>
                                    <polyline points="10 12 12 10 14 12"></polyline>
                                    <line x1="12" y1="16" x2="12" y2="10"></line>
                                </svg>
                            ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                                    <rect x="1" y="3" width="22" height="5"></rect>
                                    <line x1="10" y1="12" x2="14" y2="12"></line>
                                </svg>
                            )}
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(group)}
                            title="Delete Group"
                            style={{
                                color: 'var(--red)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '6px',
                                opacity: 0.5,
                                transition: 'opacity 0.2s, background 0.2s',
                                borderRadius: '6px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(255,68,68,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    )}
                </td>
            )}
        </tr>
    );
}
