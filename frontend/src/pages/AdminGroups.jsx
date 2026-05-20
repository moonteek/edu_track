import { useState, useEffect } from 'react';
import { api } from '../api';
import { totalDone, totalLessons, pct, tagCls, MODULES, PC, calcExamDate } from '../constants';
import { useToast } from '../components/Toast';
import Skeleton from '../components/Skeleton';
import GroupRow from '../components/GroupRow';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const DAYS_OPTIONS = ['Odd Days', 'Even Days', 'Every Day'];

function generateTimeSlots() {
    const slots = [];
    for (let h = 8; h <= 19; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    slots.push('20:00');
    return slots;
}

const TIME_SLOTS = generateTimeSlots();

const EMPTY_FORM = {
    tid: '',
    group: '',
    lang: '',
    level: 1,
    doneInLevel: 0,
    startTime: '',
    endTime: '',
    days: 'Odd Days',
    start: '',
    exam: '',
    students: '',
    autoProgress: false,
};

export default function AdminGroups({ token, onLogout }) {
    const [teachers, setTeachers] = useState(null);
    const [allGroups, setAllGroups] = useState(null);
    const [langFilter, setLangFilter] = useState('all');
    const [moduleFilter, setModuleFilter] = useState('all');
    const [progFilter, setProgFilter] = useState('all');
    const [showArchived, setShowArchived] = useState(false);
    const showToast = useToast();

    // Delete confirm
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMsg, setConfirmMsg] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Bulk delete
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

    // Create / Edit modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => { loadData(); }, [showArchived]);

    async function loadData() {
        try {
            setTeachers(null); setAllGroups(null);
            const [t, g] = await Promise.all([
                api('GET', '/api/teachers', null, token, onLogout),
                api('GET', `/api/groups${showArchived ? '?archived=true' : ''}`, null, token, onLogout),
            ]);
            setTeachers(t);
            setAllGroups(g);
        } catch (err) {
            setTeachers([]); setAllGroups([]);
            showToast(err.message, true);
        }
    }

    const loading = teachers === null || allGroups === null;

    let filtered = allGroups || [];
    if (moduleFilter !== 'all') {
        const moduleCourses = MODULES[moduleFilter] || [];
        filtered = filtered.filter((g) => moduleCourses.includes(g.lang));
    }
    if (langFilter !== 'all') filtered = filtered.filter((g) => g.lang === langFilter);
    if (progFilter !== 'all') filtered = filtered.filter((g) => {
        const p = pct(totalDone(g.level, g.doneInLevel), totalLessons(g.lang));
        return progFilter === 'not-started' ? p === 0 : progFilter === 'in-progress' ? p > 0 && p < 100 : p === 100;
    });

    const availableSubjects = moduleFilter !== 'all'
        ? { [moduleFilter]: MODULES[moduleFilter] }
        : MODULES;

    const progs = [
        { key: 'all', label: 'All' },
        { key: 'not-started', label: 'Not Started (0%)' },
        { key: 'in-progress', label: 'In Progress (1-99%)' },
        { key: 'completed', label: 'Completed (100%)' },
    ];

    // ── Form helpers ──────────────────────────────────────────────
    function setField(key, val) {
        setForm(f => {
            const next = { ...f, [key]: val };
            // Auto-calc exam when start or days change
            if ((key === 'start' || key === 'days') && next.start && next.days) {
                try { next.exam = calcExamDate(next.start, next.days); } catch { /* ignore */ }
            }
            // Auto-calc endTime when startTime or lang changes
            if (key === 'startTime' || key === 'lang') {
                const isKids = next.lang === 'Python (Kids)' || next.lang === 'Scratch';
                const dur = isKids ? 90 : 120;
                if (next.startTime) {
                    const [h, m] = next.startTime.split(':').map(Number);
                    const total = h * 60 + m + dur;
                    next.endTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                }
            }
            // Reset level when lang changes
            if (key === 'lang') { next.level = 1; next.doneInLevel = 0; }
            return next;
        });
    }

    function openCreate() {
        setEditingId(null);
        setForm({ ...EMPTY_FORM, tid: (teachers && teachers[0]?.id) || '' });
        setFormError('');
        setModalOpen(true);
    }

    function openEdit(group) {
        setEditingId(group.id || group._id);
        setForm({
            tid: group.tid || '',
            group: group.group || '',
            lang: group.lang || '',
            level: group.level || 1,
            doneInLevel: group.doneInLevel || 0,
            startTime: group.startTime || '',
            endTime: group.endTime || '',
            days: group.days || 'Odd Days',
            start: group.start ? group.start.substring(0, 10) : '',
            exam: group.exam ? group.exam.substring(0, 10) : '',
            students: group.students || '',
            autoProgress: group.autoProgress || false,
        });
        setFormError('');
        setModalOpen(true);
    }

    function closeModal() { setModalOpen(false); setEditingId(null); }

    async function handleSubmit() {
        const { tid, group, lang, level, doneInLevel, startTime, endTime, days, start, exam, students, autoProgress } = form;
        if (!tid || !group.trim() || !lang || !startTime || !endTime || !start || !exam || !students) {
            setFormError('Please fill in all required fields.');
            return;
        }
        setFormError('');
        setFormLoading(true);
        try {
            const body = {
                tid,
                group: group.trim(),
                lang,
                level: +level,
                doneInLevel: +(doneInLevel || 0),
                startTime,
                endTime,
                days,
                start,
                exam,
                students: +students,
                autoProgress: !!autoProgress,
            };
            if (editingId) {
                await api('PUT', '/api/groups/' + editingId, body, token, onLogout);
                showToast('Group updated successfully');
            } else {
                await api('POST', '/api/groups', body, token, onLogout);
                showToast('Group created successfully');
            }
            closeModal();
            loadData();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setFormLoading(false);
        }
    }

    // ── Delete ────────────────────────────────────────────────────
    function handleDeleteClick(group) {
        setPendingDeleteId(group.id || group._id);
        setConfirmMsg(`Delete group <strong>${group.group}</strong> (${group.lang})?<br>This action cannot be undone.`);
        setConfirmOpen(true);
    }

    async function handleArchive(group) {
        const id = group.id || group._id;
        const endpoint = group.archived ? `/api/groups/${id}/unarchive` : `/api/groups/${id}/archive`;
        try {
            await api('PUT', endpoint, null, token, onLogout);
            showToast(group.archived ? 'Group restored successfully' : 'Group archived successfully');
            loadData();
        } catch (err) {
            showToast(err.message, true);
        }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            await api('DELETE', '/api/groups/' + pendingDeleteId, null, token, onLogout);
            setConfirmOpen(false); setPendingDeleteId(null);
            loadData();
            showToast('Group deleted successfully');
        } catch (err) {
            showToast(err.message, true);
        } finally {
            setDeleting(false);
        }
    }

    function toggleSelect(id) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    }

    async function handleBulkDelete() {
        setBulkDeleting(true);
        try {
            const result = await api('POST', '/api/groups/bulk-delete', { ids: Array.from(selectedIds) }, token, onLogout);
            setBulkConfirmOpen(false);
            setSelectedIds(new Set());
            loadData();
            showToast(`${result.deletedCount || selectedIds.size} groups deleted successfully`);
        } catch (err) {
            showToast(err.message, true);
        } finally {
            setBulkDeleting(false);
        }
    }

    // ── Derived for form ──────────────────────────────────────────
    const selectedLangCfg = PC[form.lang];
    const maxLevel = selectedLangCfg?.levels || 1;

    return (
        <div className="panel-body">
            {/* Top bar: Create button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button className="add-btn" onClick={openCreate} style={{ margin: 0 }}>
                    <span className="add-icon">+</span>Add Group
                </button>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'flex-start' }}>
                {/* Module filter */}
                <div>
                    <span className="slabel" style={{ marginBottom: '10px' }}>Filter by Module</span>
                    <div className="filter-row" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
                        <span className="filter-label">Module:</span>
                        {[{ key: 'all', label: 'All' }, ...Object.keys(MODULES).map(m => ({ key: m, label: m }))].map(m => (
                            <button
                                key={m.key}
                                className={'filter-btn' + (moduleFilter === m.key ? ' active' : '')}
                                onClick={() => { setModuleFilter(m.key); setLangFilter('all'); }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'flex-start' }}>
                {/* Subject filter */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <span className="slabel" style={{ marginBottom: '10px' }}>Filter by Subject</span>
                    <div className="filter-row" id="lang-filter-bar" style={{ alignItems: 'center', marginBottom: 0 }}>
                        <span className="filter-label">Subject:</span>
                        <select className="f-select" style={{ width: 'auto', padding: '8px 30px 8px 16px', fontSize: '13px' }} value={langFilter} onChange={(e) => setLangFilter(e.target.value)}>
                            <option value="all">All Subjects</option>
                            {Object.entries(availableSubjects).map(([mod, subjs]) => (
                                <optgroup key={mod} label={mod}>
                                    {subjs.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Progress filter */}
                <div style={{ flex: 2, minWidth: '280px' }}>
                    <span className="slabel" style={{ marginBottom: '10px' }}>Filter by Progress</span>
                    <div className="filter-row" id="prog-filter-bar" style={{ marginBottom: 0 }}>
                        <span className="filter-label">Progress:</span>
                        {progs.map((p) => (
                            <button key={p.key} className={'filter-btn' + (progFilter === p.key ? ' active' : '')} onClick={() => setProgFilter(p.key)}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="slabel" style={{ margin: 0 }}>Groups by Teacher</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className={'filter-btn' + (!showArchived ? ' active' : '')}
                            onClick={() => setShowArchived(false)}
                            style={{
                                padding: '4px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                            Active
                        </button>
                        <button
                            className={'filter-btn' + (showArchived ? ' active' : '')}
                            onClick={() => setShowArchived(true)}
                            style={{
                                padding: '4px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="21 8 21 21 3 21 3 8"></polyline>
                                <rect x="1" y="3" width="22" height="5"></rect>
                                <line x1="10" y1="12" x2="14" y2="12"></line>
                            </svg>
                            Archived
                        </button>
                    </div>
                </div>
                <button
                    className={`filter-btn ${selectedIds.size > 0 ? 'active' : ''}`}
                    style={{
                        background: selectedIds.size > 0 ? 'var(--red)' : 'transparent',
                        color: selectedIds.size > 0 ? 'white' : 'var(--gray)',
                        borderColor: selectedIds.size > 0 ? 'var(--red)' : 'var(--border2)',
                        padding: '6px 12px',
                        cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                        opacity: selectedIds.size > 0 ? 1 : 0.5
                    }}
                    onClick={() => selectedIds.size > 0 && setBulkConfirmOpen(true)}
                    disabled={selectedIds.size === 0}
                >
                    Delete Selected ({selectedIds.size})
                </button>
            </div>

            {
                loading ? <Skeleton /> : !filtered.length ? (
                    <div className="empty-state"><div className="empty-line">NO RESULTS</div><p>No groups match the selected filters.</p></div>
                ) : (
                    (teachers || []).map((t) => {
                        const gs = filtered.filter((g) => g.tid === t.id);
                        if (!gs.length) return null;
                        return (
                            <div key={t.id} className="teacher-section">
                                <div className="teacher-hdr">
                                    <div className="t-avatar">{t.name.charAt(0)}</div>
                                    <div>
                                        <div className="t-name-big">
                                            {t.name}
                                            {(Array.isArray(t.subject) ? t.subject : [t.subject]).map(s => (
                                                <span key={s} className="t-badge" style={{ marginLeft: '8px' }}>{s}</span>
                                            ))}
                                        </div>
                                        <div className="t-count">{gs.length} group{gs.length > 1 ? 's' : ''} &nbsp;·&nbsp; {gs.reduce((a, g) => a + g.students, 0)} students</div>
                                    </div>
                                </div>
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={gs.length > 0 && gs.every(g => selectedIds.has(g.id || g._id))}
                                                        onChange={() => {
                                                            const allSelected = gs.length > 0 && gs.every(g => selectedIds.has(g.id || g._id));
                                                            const next = new Set(selectedIds);
                                                            if (allSelected) {
                                                                gs.forEach(g => next.delete(g.id || g._id));
                                                            } else {
                                                                gs.forEach(g => next.add(g.id || g._id));
                                                            }
                                                            setSelectedIds(next);
                                                        }}
                                                        style={{ cursor: 'pointer', width: '16px', height: '16px', opacity: 0.8 }}
                                                    />
                                                </th>
                                                <th>Group</th><th>Language</th><th>Level</th><th>Time</th><th>Schedule</th><th>Start</th><th>Exam</th><th>Students</th><th>Done</th><th>Progress</th><th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>{gs.map((g) => (
                                            <GroupRow
                                                key={g.id || g._id}
                                                group={g}
                                                onEdit={openEdit}
                                                onDelete={handleDeleteClick}
                                                onArchive={handleArchive}
                                                selected={selectedIds.has(g.id || g._id)}
                                                onSelect={toggleSelect}
                                            />
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )
            }

            {/* ── Create / Edit Group Modal ── */}
            <Modal open={modalOpen} onClose={closeModal} className="" style={{ maxWidth: '560px' }}>
                <div className="modal-hd">
                    <div>
                        <div className="modal-title">{editingId ? 'Edit Group' : 'Create New Group'}</div>
                        <div className="modal-sub">{editingId ? 'Update group details' : 'Fill in all details to add a new group'}</div>
                    </div>
                    <button className="modal-close" onClick={closeModal}>×</button>
                </div>

                {/* Teacher */}
                <div className="f-group">
                    <label className="f-label">Teacher <span style={{ color: 'var(--red)' }}>*</span></label>
                    <select className="f-select" value={form.tid} onChange={e => setField('tid', e.target.value)}>
                        <option value="">Select teacher</option>
                        {(teachers || []).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                {/* Two columns: Group name + Subject */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Group Name <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input className="f-input" type="text" placeholder="e.g. JS-101" value={form.group} onChange={e => setField('group', e.target.value)} />
                    </div>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Subject <span style={{ color: 'var(--red)' }}>*</span></label>
                        <select className="f-select" value={form.lang} onChange={e => setField('lang', e.target.value)}>
                            <option value="">Select subject</option>
                            {Object.entries(MODULES).map(([cat, courses]) => (
                                <optgroup key={cat} label={cat}>
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Level + Done in level */}
                {form.lang && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="f-group" style={{ margin: 0 }}>
                            <label className="f-label">Level (1 – {maxLevel})</label>
                            <input className="f-input" type="number" min="1" max={maxLevel} value={form.level}
                                onChange={e => setField('level', Math.min(maxLevel, Math.max(1, +e.target.value)))} />
                        </div>
                        <div className="f-group" style={{ margin: 0 }}>
                            <label className="f-label">Done in Level (0 – 13)</label>
                            <input className="f-input" type="number" min="0" max="13" value={form.doneInLevel}
                                onChange={e => setField('doneInLevel', Math.min(13, Math.max(0, +e.target.value)))} />
                        </div>
                    </div>
                )}

                {/* Schedule row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Start Time <span style={{ color: 'var(--red)' }}>*</span></label>
                        <select className="f-select" value={form.startTime} onChange={e => setField('startTime', e.target.value)}>
                            <option value="">–</option>
                            {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">End Time</label>
                        <input className="f-input" type="text" value={form.endTime} readOnly
                            style={{ opacity: 0.6, cursor: 'default' }} placeholder="Auto-calculated" />
                    </div>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Days <span style={{ color: 'var(--red)' }}>*</span></label>
                        <select className="f-select" value={form.days} onChange={e => setField('days', e.target.value)}>
                            {DAYS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* Dates + Students */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Start Date <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input className="f-input" type="date" value={form.start} onChange={e => setField('start', e.target.value)} />
                    </div>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Exam Date</label>
                        <input className="f-input" type="date" value={form.exam} onChange={e => setField('exam', e.target.value)}
                            style={{ opacity: form.start ? 1 : 0.5 }} />
                    </div>
                    <div className="f-group" style={{ margin: 0 }}>
                        <label className="f-label">Students <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input className="f-input" type="number" min="1" max="25" placeholder="1–25" value={form.students}
                            onChange={e => setField('students', e.target.value)} />
                    </div>
                </div>

                {/* Dynamic auto-progress checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border2)' }}>
                    <input 
                        type="checkbox" 
                        id="autoProgress" 
                        checked={form.autoProgress || false} 
                        onChange={e => setField('autoProgress', e.target.checked)} 
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--yellow)', margin: 0 }} 
                    />
                    <label htmlFor="autoProgress" style={{ color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--fm)', fontWeight: 600, cursor: 'pointer', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>Progress Automatically</span>
                        <span style={{ fontSize: '11px', color: 'var(--gray)', fontWeight: 400 }}>Dynamically advances levels and lessons based on real days elapsed since start date.</span>
                    </label>
                </div>

                {formError && (
                    <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '13px', fontFamily: 'var(--fm)' }}>
                        {formError}
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn-submit" onClick={handleSubmit} disabled={formLoading}>
                        {formLoading ? 'Saving...' : editingId ? 'Save Changes' : 'Create Group'}
                    </button>
                    <button className="btn-cancel" onClick={closeModal}>Cancel</button>
                </div>
            </Modal>

            <ConfirmModal
                open={confirmOpen}
                onClose={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
                onConfirm={handleDelete}
                message={confirmMsg}
                loading={deleting}
            />

            <ConfirmModal
                open={bulkConfirmOpen}
                onClose={() => setBulkConfirmOpen(false)}
                onConfirm={handleBulkDelete}
                message={`Delete ${selectedIds.size} selected groups?<br>This action cannot be undone.`}
                loading={bulkDeleting}
            />
        </div>
    );
}
