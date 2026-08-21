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
    const [activeTab, setActiveTab] = useState('formulas'); // 'formulas' | 'tips'
    const [format, setFormat] = useState('xlsx');
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
            const baseUrl = import.meta.env.VITE_API_URL || (window.location.origin.includes('localhost') ? 'http://localhost:5000' : 'https://edu-track-backend.onrender.com');
            setSyncConfig({
                syncKey: 'edutrack_sync_2026',
                urls: {
                    students: `${baseUrl}/api/sync/students?key=edutrack_sync_2026`,
                    teachers: `${baseUrl}/api/sync/teachers?key=edutrack_sync_2026`,
                    courses: `${baseUrl}/api/sync/courses?key=edutrack_sync_2026`,
                    schedule: `${baseUrl}/api/sync/schedule?key=edutrack_sync_2026`,
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

    const defaultBase = 'https://edu-track-x27a.onrender.com';
    const studentsUrl = syncConfig?.urls?.students || `${defaultBase}/api/sync/students?key=edutrack_sync_2026`;
    const teachersUrl = syncConfig?.urls?.teachers || `${defaultBase}/api/sync/teachers?key=edutrack_sync_2026`;
    const coursesUrl = syncConfig?.urls?.courses || `${defaultBase}/api/sync/courses?key=edutrack_sync_2026`;
    const scheduleUrl = syncConfig?.urls?.schedule || `${defaultBase}/api/sync/schedule?key=edutrack_sync_2026`;

    const sheetsFeeds = [
        {
            title: 'Teacher Schedule & Availability Matrix',
            tag: 'Tab: Schedule',
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.12)',
            border: 'rgba(16, 185, 129, 0.3)',
            desc: 'Live matrix of all teacher time slots (08:00-20:00), odd/even days, active group lessons, and Free/Busy statuses.',
            formula: `=IMPORTDATA("${scheduleUrl}")`,
            url: scheduleUrl,
            icon: '🗓️'
        },
        {
            title: 'Active Students & Upcoming Graduations',
            tag: 'Tab: Students',
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.12)',
            border: 'rgba(56, 189, 248, 0.3)',
            desc: 'Real-time group stages, levels, lessons completed, schedule slots, exam dates & days remaining.',
            formula: `=IMPORTDATA("${studentsUrl}")`,
            url: studentsUrl,
            icon: '🎓'
        },
        {
            title: 'Teacher Hours & Weekly Workloads',
            tag: 'Tab: Teacher Hours',
            color: '#a855f7',
            bg: 'rgba(168, 85, 247, 0.12)',
            border: 'rgba(168, 85, 247, 0.3)',
            desc: 'Active group counts, total assigned students, and automated weekly teaching hours per teacher.',
            formula: `=IMPORTDATA("${teachersUrl}")`,
            url: teachersUrl,
            icon: '👨‍🏫'
        },
        {
            title: 'Course Completion & Department Rates',
            tag: 'Tab: Course Rates',
            color: '#f43f5e',
            bg: 'rgba(244, 63, 94, 0.12)',
            border: 'rgba(244, 63, 94, 0.3)',
            desc: 'Department-wide breakdown, active level distributions, and overall completion percentages.',
            formula: `=IMPORTDATA("${coursesUrl}")`,
            url: coursesUrl,
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
                        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(245, 197, 24, 0.08))',
                        border: '1px solid rgba(76, 175, 80, 0.35)',
                        color: 'var(--white)',
                        fontWeight: 600,
                        fontSize: '13px',
                        padding: '8px 16px',
                        borderRadius: '9px',
                        cursor: exporting ? 'wait' : 'pointer',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#4caf50';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.25)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(76, 175, 80, 0.35)';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)';
                    }}
                >
                    <span style={{ display: 'inline-flex', width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', boxShadow: '0 0 8px #4caf50' }}></span>
                    {exporting ? 'Exporting...' : 'Live Sync & Reports'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--gray)' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>

                {open && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            zIndex: 1000,
                            minWidth: '340px',
                            background: 'rgba(20, 20, 24, 0.96)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '16px',
                            padding: '10px',
                            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(24px)',
                            animation: 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                    >
                        {/* FEATURED: Google Sheets Live Sync Card */}
                        <button
                            type="button"
                            onClick={openSheetsModal}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '12px 14px',
                                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.22), rgba(30, 90, 40, 0.12))',
                                border: '1px solid rgba(76, 175, 80, 0.45)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                marginBottom: '12px',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#4caf50';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.3)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(76, 175, 80, 0.45)';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '20px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76, 175, 80, 0.25)', borderRadius: '10px', border: '1px solid rgba(76, 175, 80, 0.4)' }}>
                                    📊
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Google Sheets Live Sync</span>
                                        <span style={{ fontSize: '9px', background: '#4caf50', color: '#000', padding: '2px 6px', borderRadius: '6px', fontWeight: 800, letterSpacing: '0.4px' }}>LIVE FEED</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px' }}>
                                        Auto-updates without downloading files
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Format Switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--fm)' }}>
                                Offline File Export:
                            </span>
                            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormat('xlsx')}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
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
                                        borderRadius: '6px',
                                        padding: '4px 10px',
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

                        <div style={{ padding: '8px 8px 4px', fontSize: '10px', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--fm)' }}>
                            Offline Downloads ({format.toUpperCase()})
                        </div>

                        <button
                            type="button"
                            onClick={() => handleExport('master')}
                            style={menuItemStyle}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 197, 24, 0.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ ...iconBadgeStyle, background: 'rgba(245, 197, 24, 0.2)', color: 'var(--yellow)' }}>📦</span>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>
                                        {format === 'xlsx' ? 'Master Excel Workbook (.xlsx)' : 'Download All 3 Files (.csv)'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--gl)' }}>
                                        {format === 'xlsx' ? 'Multi-sheet workbook with all 3 tabs' : 'All 3 datasets in separate CSV files'}
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
                                <span style={{ ...iconBadgeStyle, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>🎓</span>
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
                                <span style={{ ...iconBadgeStyle, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>👨‍🏫</span>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--white)' }}>Teacher Hours & Workloads</div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Weekly teaching hours & schedules</div>
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
                                <span style={{ ...iconBadgeStyle, background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>📈</span>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--white)' }}>Course Completion Rates</div>
                                    <div style={{ fontSize: '11px', color: 'var(--gray)' }}>Category & module completion stats</div>
                                </div>
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* ── GOOGLE SHEETS LIVE SYNC HUB MODAL ── */}
            <Modal open={sheetsModalOpen} onClose={() => setSheetsModalOpen(false)} style={{ maxWidth: '680px' }}>
                {/* Modal Header */}
                <div className="modal-hd" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                    <div>
                        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(76, 175, 80, 0.2)', border: '1px solid rgba(76, 175, 80, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                📊
                            </div>
                            <span>Google Sheets Live Cloud Sync</span>
                        </div>
                        <div className="modal-sub" style={{ marginTop: '4px', fontSize: '12px' }}>
                            Continuous live connection between MongoDB Atlas and your Google Sheet
                        </div>
                    </div>
                    <button className="modal-close" onClick={() => setSheetsModalOpen(false)}>×</button>
                </div>

                {/* Subnav Tabs */}
                <div style={{ display: 'flex', gap: '8px', margin: '16px 0 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('formulas')}
                        style={{
                            background: activeTab === 'formulas' ? 'rgba(76, 175, 80, 0.18)' : 'transparent',
                            border: activeTab === 'formulas' ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid transparent',
                            color: activeTab === 'formulas' ? '#4caf50' : 'var(--gray)',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        ⚡ 1-Click Formulas (Setup)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('tips')}
                        style={{
                            background: activeTab === 'tips' ? 'rgba(245, 197, 24, 0.15)' : 'transparent',
                            border: activeTab === 'tips' ? '1px solid rgba(245, 197, 24, 0.4)' : '1px solid transparent',
                            color: activeTab === 'tips' ? 'var(--yellow)' : 'var(--gray)',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        🎨 Pro Styling Guide
                    </button>
                </div>

                {activeTab === 'formulas' ? (
                    <div>
                        {/* Hero Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.12), rgba(30, 90, 40, 0.06))',
                            border: '1px solid rgba(76, 175, 80, 0.28)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4caf50', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>🚀 Quick 3-Step Setup:</span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--gl)', marginTop: '4px', lineHeight: '1.5' }}>
                                    1. Open your sheet &nbsp;➡️&nbsp; 2. Create 3 tabs &nbsp;➡️&nbsp; 3. Paste formula into cell <strong>A1</strong> of each tab.
                                </div>
                            </div>
                            <a
                                href="https://sheets.new"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#4caf50',
                                    color: '#000',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            >
                                Open Google Sheet ↗
                            </a>
                        </div>

                        {/* Feeds list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {sheetsFeeds.map((feed, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: `1px solid ${feed.border}`,
                                        borderRadius: '12px',
                                        padding: '14px 16px',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>{feed.icon}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--white)' }}>{feed.title}</span>
                                        </div>
                                        <span style={{ fontSize: '11px', fontFamily: 'var(--fm)', color: feed.color, background: feed.bg, border: `1px solid ${feed.border}`, padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                            {feed.tag}
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
                                                background: '#09090b',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                padding: '9px 12px',
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
                                                borderRadius: '8px',
                                                padding: '9px 16px',
                                                fontSize: '12px',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                transition: 'all 0.2s',
                                                boxShadow: copiedIndex === idx ? '0 0 12px rgba(76, 175, 80, 0.5)' : 'none',
                                            }}
                                        >
                                            {copiedIndex === idx ? '✓ Copied!' : 'Copy Formula'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Tab 2: Pro Styling Guide */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)', marginBottom: '8px' }}>
                                🎨 How to make your Google Sheet look executive & beautiful:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--gl)', lineHeight: '1.6' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <span style={{ background: 'rgba(245, 197, 24, 0.2)', color: 'var(--yellow)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>1</span>
                                    <div>
                                        <strong style={{ color: 'var(--white)' }}>Add Alternating Row Colors:</strong><br />
                                        In your Google Sheet, select all (`Ctrl+A`), click top menu <strong>Format ➡️ Alternating Colors</strong>, then choose the modern Dark Grey or Emerald Green theme.
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <span style={{ background: 'rgba(245, 197, 24, 0.2)', color: 'var(--yellow)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>2</span>
                                    <div>
                                        <strong style={{ color: 'var(--white)' }}>Freeze Top Header Row:</strong><br />
                                        Click <strong>View ➡️ Freeze ➡️ 1 Row</strong>. This keeps your column headers visible while scrolling down through hundreds of groups.
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                    <span style={{ background: 'rgba(245, 197, 24, 0.2)', color: 'var(--yellow)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>3</span>
                                    <div>
                                        <strong style={{ color: 'var(--white)' }}>Auto-Fit Column Widths:</strong><br />
                                        Select all columns (`Ctrl+A`) and double-click any column border line at the top. Google Sheets will automatically fit every column perfectly to text size!
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--gray)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4caf50', display: 'inline-block' }}></span>
                        Render live feed active
                    </div>
                    <button
                        type="button"
                        onClick={() => setSheetsModalOpen(false)}
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'var(--white)',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Done
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
    padding: '9px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
};

const iconBadgeStyle = {
    fontSize: '16px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
};



