import { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { useToast } from './Toast';
import Modal from './Modal';
import { 
    exportTeacherHoursReport, 
    exportStudentsAndGraduationsReport, 
    exportCourseCompletionReport,
    exportMasterExcelReport
} from '../exportReports';

export default function ExportReportsButton({ token, onLogout, teachers: propTeachers, groups: propGroups }) {
    const [open, setOpen] = useState(false);
    const [sheetsModalOpen, setSheetsModalOpen] = useState(false);
    const [format, setFormat] = useState('xlsx'); // 'xlsx' or 'csv'
    const [exporting, setExporting] = useState(false);
    const [syncConfig, setSyncConfig] = useState(null);
    const [copiedIndex, setCopiedIndex] = useState(null);

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

    async function loadSyncConfig() {
        if (syncConfig) return;
        try {
            const cfg = await api('GET', '/api/sync/config', null, token, onLogout);
            setSyncConfig(cfg);
        } catch {
            // fallback
            const baseUrl = window.location.origin.includes('localhost') ? 'http://localhost:5000' : 'https://edu-track-x27a.onrender.com';
            setSyncConfig({
                syncKey: 'edutrack_sync_2026',
                urls: {
                    students: `${baseUrl}/api/sync/students?key=edutrack_sync_2026`,
                    teachers: `${baseUrl}/api/sync/teachers?key=edutrack_sync_2026`,
                    courses: `${baseUrl}/api/sync/courses?key=edutrack_sync_2026`,
                }
            });
        }
    }

    function openSheetsModal() {
        setOpen(false);
        loadSyncConfig();
        setSheetsModalOpen(true);
    }

    function copyToClipboard(text, index) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIndex(index);
            showToast('📋 Formula copied! Paste into cell A1 in Google Sheets.');
            setTimeout(() => setCopiedIndex(null), 2500);
        }).catch(() => {
            showToast('Failed to copy', true);
        });
    }

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
                    setTimeout(() => exportStudentsAndGraduationsReport(groups, teachers), 300);
                    setTimeout(() => exportCourseCompletionReport(groups), 600);
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

    const defaultBase = 'https://edu-track-x27a.onrender.com';
    const studentsUrl = syncConfig?.urls?.students || `${defaultBase}/api/sync/students?key=edutrack_sync_2026`;
    const teachersUrl = syncConfig?.urls?.teachers || `${defaultBase}/api/sync/teachers?key=edutrack_sync_2026`;
    const coursesUrl = syncConfig?.urls?.courses || `${defaultBase}/api/sync/courses?key=edutrack_sync_2026`;

    const sheetsFeeds = [
        {
            title: '1. Students & Graduations Live Feed',
            desc: 'Active groups, current stage, lessons done, exam dates & graduation status',
            formula: `=IMPORTDATA("${studentsUrl}")`,
            tabName: 'Students & Graduations',
            icon: '🎓'
        },
        {
            title: '2. Teacher Hours & Workloads Live Feed',
            desc: 'Teacher active groups, student count & calculated weekly teaching hours',
            formula: `=IMPORTDATA("${teachersUrl}")`,
            tabName: 'Teacher Hours',
            icon: '👨‍🏫'
        },
        {
            title: '3. Course Completion Rates Live Feed',
            desc: 'Module level breakdown, student counts & average completion %',
            formula: `=IMPORTDATA("${coursesUrl}")`,
            tabName: 'Course Completion',
            icon: '📈'
        }
    ];

    return (
        <>
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
                    {exporting ? 'Exporting...' : 'Reports & Live Sync'}
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
                            minWidth: '320px',
                            background: 'var(--dark2)',
                            border: '1px solid var(--border2)',
                            borderRadius: '12px',
                            padding: '8px',
                            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
                            backdropFilter: 'blur(16px)',
                            animation: 'fadeIn 0.15s ease',
                        }}
                    >
                        {/* FEATURED: Google Sheets Live Sync */}
                        <button
                            type="button"
                            onClick={openSheetsModal}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.18), rgba(46, 125, 50, 0.1))',
                                border: '1px solid rgba(76, 175, 80, 0.35)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginBottom: '10px',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(76, 175, 80, 0.7)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(76, 175, 80, 0.35)'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '18px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76, 175, 80, 0.25)', borderRadius: '6px' }}>📊</span>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4caf50', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Google Sheets Live Sync
                                        <span style={{ fontSize: '9px', background: '#4caf50', color: '#000', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>AUTO</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--gl)' }}>Real-time updates without downloading files</div>
                                </div>
                            </div>
                        </button>

                        {/* Format Toggle (.xlsx vs .csv) */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 10px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--fm)' }}>
                                Offline File Export:
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
                            Download Files ({format.toUpperCase()})
                        </div>

                        <button
                            type="button"
                            onClick={() => handleExport('master')}
                            style={menuItemStyle}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 197, 24, 0.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ ...iconBadgeStyle, background: 'rgba(245, 197, 24, 0.2)' }}>📦</span>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>
                                        {format === 'xlsx' ? 'Master Excel Workbook (.xlsx)' : 'Download All 3 (.csv)'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--gl)' }}>
                                        {format === 'xlsx' ? 'Multi-sheet workbook with all 3 tabs' : 'All 3 datasets in CSV format'}
                                    </div>
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
                    </div>
                )}
            </div>

            {/* ── GOOGLE SHEETS LIVE SYNC SETUP MODAL ── */}
            <Modal open={sheetsModalOpen} onClose={() => setSheetsModalOpen(false)} style={{ maxWidth: '620px' }}>
                <div className="modal-hd">
                    <div>
                        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#4caf50' }}>📊</span> Google Sheets Live Sync
                        </div>
                        <div className="modal-sub">Live database feed — automatically updates without downloading files</div>
                    </div>
                    <button className="modal-close" onClick={() => setSheetsModalOpen(false)}>×</button>
                </div>

                <div style={{ padding: '4px 0 16px' }}>
                    <div style={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#4caf50', marginBottom: '4px' }}>
                            ⚡ How It Works (1-Minute Setup):
                        </div>
                        <ol style={{ fontSize: '12px', color: 'var(--gl)', lineHeight: '1.6', paddingLeft: '18px', margin: 0 }}>
                            <li>
                                Open a new Google Sheet:{' '}
                                <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--yellow)', textDecoration: 'underline', fontWeight: 600 }}>
                                    Click here to open sheets.new ↗
                                </a>
                            </li>
                            <li>Copy the formulas below and paste each into cell <strong>A1</strong> of a sheet/tab.</li>
                            <li><strong>Done!</strong> Google Sheets will continuously sync your student progress, groups, and teacher hours automatically.</li>
                        </ol>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {sheetsFeeds.map((feed, idx) => (
                            <div key={idx} style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>{feed.icon}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--white)' }}>{feed.title}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontFamily: 'var(--fm)', color: 'var(--gray)', background: 'var(--dark2)', padding: '2px 8px', borderRadius: '4px' }}>
                                        Tab: {feed.tabName}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--gray)', marginBottom: '10px' }}>
                                    {feed.desc}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        readOnly
                                        value={feed.formula}
                                        style={{
                                            flex: 1,
                                            background: 'var(--dark)',
                                            border: '1px solid var(--border2)',
                                            borderRadius: '6px',
                                            padding: '8px 12px',
                                            fontSize: '11px',
                                            fontFamily: 'var(--fm)',
                                            color: 'var(--yellow)',
                                            cursor: 'text',
                                        }}
                                        onClick={e => e.target.select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(feed.formula, idx)}
                                        style={{
                                            background: copiedIndex === idx ? '#4caf50' : 'var(--yellow)',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '8px 14px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {copiedIndex === idx ? '✓ Copied!' : 'Copy Formula'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    <button
                        type="button"
                        onClick={() => setSheetsModalOpen(false)}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border2)',
                            color: 'var(--white)',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                        }}
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </>
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


