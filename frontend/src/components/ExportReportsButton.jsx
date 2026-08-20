import { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import { 
    exportTeacherHoursReport, 
    exportStudentsAndGraduationsReport, 
    exportCourseCompletionReport,
    exportMasterExcelReport
} from '../exportReports';

export default function ExportReportsButton({ token, onLogout, teachers: propTeachers, groups: propGroups }) {
    const [open, setOpen] = useState(false);
    const [format, setFormat] = useState('xlsx'); // 'xlsx' or 'csv'
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
                exportTeacherHoursReport(teachers, groups, format);
                showToast(`✅ Teacher hours report exported as .${format.toUpperCase()}`);
            } else if (type === 'students') {
                exportStudentsAndGraduationsReport(groups, teachers, format);
                showToast(`✅ Students & graduations report exported as .${format.toUpperCase()}`);
            } else if (type === 'courses') {
                exportCourseCompletionReport(groups, format);
                showToast(`✅ Course completion report exported as .${format.toUpperCase()}`);
            } else if (type === 'master') {
                if (format === 'xlsx') {
                    exportMasterExcelReport(teachers, groups);
                    showToast('✅ Multi-sheet Excel Master Workbook exported');
                } else {
                    exportTeacherHoursReport(teachers, groups, 'csv');
                    setTimeout(() => exportStudentsAndGraduationsReport(groups, teachers, 'csv'), 300);
                    setTimeout(() => exportCourseCompletionReport(groups, 'csv'), 600);
                    showToast('✅ All 3 CSV reports downloaded');
                }
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
                {exporting ? 'Exporting...' : 'Export Excel / CSV'}
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
                        minWidth: '310px',
                        background: 'var(--dark2)',
                        border: '1px solid var(--border2)',
                        borderRadius: '12px',
                        padding: '8px',
                        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(16px)',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    {/* Format Toggle (.xlsx vs .csv) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 10px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--fm)' }}>
                            Export Format:
                        </span>
                        <div style={{ display: 'flex', gap: '4px', background: 'var(--dark3)', padding: '2px', borderRadius: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setFormat('xlsx')}
                                style={{
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: format === 'xlsx' ? 'var(--yellow)' : 'transparent',
                                    color: format === 'xlsx' ? '#000' : 'var(--gl)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                .XLSX (Excel)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat('csv')}
                                style={{
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: format === 'csv' ? 'var(--yellow)' : 'transparent',
                                    color: format === 'csv' ? '#000' : 'var(--gl)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                .CSV
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: '6px 8px 4px', fontSize: '10px', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--fm)' }}>
                        Available Reports ({format.toUpperCase()})
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
                                <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Workloads, schedules & hours/week</div>
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
                                <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Category & module completion stats</div>
                            </div>
                        </div>
                    </button>

                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 6px' }} />

                    <button
                        type="button"
                        onClick={() => handleExport('master')}
                        style={menuItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 197, 24, 0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ ...iconBadgeStyle, background: 'rgba(245, 197, 24, 0.2)' }}>📊</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>
                                    {format === 'xlsx' ? 'Master Excel Workbook (.xlsx)' : 'Export All 3 (.csv)'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--gl)' }}>
                                    {format === 'xlsx' ? 'Multi-sheet workbook with all 3 tabs' : 'Download all 3 CSV datasets'}
                                </div>
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

