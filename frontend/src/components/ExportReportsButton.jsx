import { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { exportTeacherHoursReport, exportStudentsAndGraduationsReport, exportCourseCompletionReport } from '../exportReports';

export default function ExportReportsButton({ token, onLogout, teachers: propTeachers, groups: propGroups }) {
    const [open, setOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const dropdownRef = useRef(null);
    const showToast = useToast();

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    async function ensureData() {
        let t = propTeachers;
        let g = propGroups;
        if (!t || !g) {
            const [fetchedT, fetchedG] = await Promise.all([
                t ? Promise.resolve(t) : api('GET', '/api/teachers', null, token, onLogout),
                g ? Promise.resolve(g) : api('GET', '/api/groups', null, token, onLogout),
            ]);
            t = fetchedT;
            g = fetchedG;
        }
        return { teachers: t || [], groups: g || [] };
    }

    async function handleExport(type) {
        try {
            setExporting(true);
            const { teachers, groups } = await ensureData();

            if (type === 'teachers') {
                exportTeacherHoursReport(teachers, groups);
                showToast('✅ Teacher hours report exported successfully');
            } else if (type === 'students') {
                exportStudentsAndGraduationsReport(groups, teachers);
                showToast('✅ Students & graduations report exported successfully');
            } else if (type === 'courses') {
                exportCourseCompletionReport(groups);
                showToast('✅ Course completion report exported successfully');
            } else if (type === 'all') {
                exportTeacherHoursReport(teachers, groups);
                setTimeout(() => exportStudentsAndGraduationsReport(groups, teachers), 300);
                setTimeout(() => exportCourseCompletionReport(groups), 600);
                showToast('✅ All 3 reports exported successfully');
            }
            setOpen(false);
        } catch (err) {
            showToast('Export failed: ' + err.message, true);
        } finally {
            setExporting(false);
        }
    }

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                className="filter-btn"
                onClick={() => setOpen(!open)}
                disabled={exporting}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(245, 197, 24, 0.08)',
                    borderColor: 'var(--yborder)',
                    color: 'var(--yellow)',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: exporting ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                {exporting ? 'Exporting...' : 'Export Reports'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 1000,
                        minWidth: '290px',
                        background: 'var(--dark2)',
                        border: '1px solid var(--border2)',
                        borderRadius: '12px',
                        padding: '6px',
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(16px)',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    <div style={{ padding: '8px 12px 4px', fontSize: '11px', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--fm)' }}>
                        Excel / CSV Reports
                    </div>

                    <button
                        type="button"
                        onClick={() => handleExport('teachers')}
                        style={menuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={iconBadgeStyle}>👨‍🏫</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--white)' }}>Teacher Hours & Groups</div>
                                <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Workload, schedules & weekly hours</div>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('students')}
                        style={menuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={iconBadgeStyle}>🎓</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--white)' }}>Students & Graduations</div>
                                <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Level progress, exam dates & days left</div>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExport('courses')}
                        style={menuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={iconBadgeStyle}>📈</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--white)' }}>Course Completion Rates</div>
                                <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Category & module success rates</div>
                            </div>
                        </div>
                    </button>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 6px' }} />

                    <button
                        type="button"
                        onClick={() => handleExport('all')}
                        style={menuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 197, 24, 0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ ...iconBadgeStyle, background: 'rgba(245, 197, 24, 0.2)' }}>📦</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>Export All (3-in-1)</div>
                                <div style={{ fontSize: '11px', color: 'var(--gl)' }}>Download all datasets simultaneously</div>
                            </div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}

const menuItemStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
};

const iconBadgeStyle = {
    fontSize: '16px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px',
};
