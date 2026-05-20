import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Skeleton from '../components/Skeleton';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminAdmins({ token, onLogout }) {
    const [admins, setAdmins] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [admUser, setAdmUser] = useState('');
    const [admPass, setAdmPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const showToast = useToast();

    // Delete confirmation
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [pendingDeleteUser, setPendingDeleteUser] = useState('');
    const [deleting, setDeleting] = useState(false);

    useEffect(() => { loadAdmins(); }, []);

    async function loadAdmins() {
        try {
            setAdmins(null);
            const data = await api('GET', '/api/admins', null, token, onLogout);
            setAdmins(data);
        } catch (err) {
            setAdmins([]);
            showToast(err.message, true);
        }
    }

    function openCreate() {
        setEditingId(null);
        setAdmUser(''); setAdmPass(''); setFormError('');
        setModalOpen(true);
    }

    function openEdit(admin) {
        setEditingId(admin.id || admin._id);
        setAdmUser(admin.username);
        setAdmPass('');
        setFormError('');
        setModalOpen(true);
    }

    async function handleSubmit() {
        if (!admUser.trim()) {
            setFormError('Username is required'); return;
        }
        if (!editingId && !admPass.trim()) {
            setFormError('Password is required'); return;
        }
        setFormError(''); setLoading(true);
        try {
            if (editingId) {
                const body = { username: admUser.trim() };
                if (admPass.trim()) body.password = admPass.trim();
                await api('PUT', `/api/admins/${editingId}`, body, token, onLogout);
                showToast('Administrator updated successfully');
            } else {
                await api('POST', '/api/admins', {
                    username: admUser.trim(),
                    password: admPass.trim()
                }, token, onLogout);
                showToast('New administrator created successfully');
            }
            setModalOpen(false);
            loadAdmins();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleDeleteClick(admin) {
        setPendingDeleteId(admin.id || admin._id);
        setPendingDeleteUser(admin.username);
        setConfirmOpen(true);
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            await api('DELETE', `/api/admins/${pendingDeleteId}`, null, token, onLogout);
            showToast('Administrator deleted successfully');
            setConfirmOpen(false);
            setPendingDeleteId(null);
            loadAdmins();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            setDeleting(false);
        }
    }

    const isLoading = admins === null;

    return (
        <div className="panel-body" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="panel-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button className="btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Admin
                </button>
            </div>

            {isLoading ? (
                <Skeleton />
            ) : !admins.length ? (
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'var(--gray)' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--yellow)', marginBottom: '8px', fontFamily: 'var(--fm)', letterSpacing: '1px' }}>DEFAULT SYSTEM ADMIN ONLY</div>
                    <p style={{ fontSize: '13px', margin: 0, fontFamily: 'var(--fm)' }}>You are currently running on the system's hardcoded credentials. Add your first database-backed admin above!</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Created At</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map((admin) => (
                                <tr key={admin.id || admin._id}>
                                    <td className="td-w" style={{ fontWeight: 600 }}>@{admin.username}</td>
                                    <td>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245,197,24,0.12)', color: 'var(--yellow)', border: '1px solid rgba(245,197,24,0.25)', padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--fm)', letterSpacing: '0.5px' }}>
                                            ADMINISTRATOR
                                        </span>
                                    </td>
                                    <td className="td-m" style={{ fontFamily: 'var(--fm)', fontSize: '12px', color: 'var(--gray)' }}>
                                        {new Date(admin.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <button
                                            onClick={() => openEdit(admin)}
                                            title="Edit Admin"
                                            style={{
                                                color: 'var(--primary)',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '6px',
                                                opacity: 0.6,
                                                transition: 'all 0.2s',
                                                borderRadius: '6px'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button
                                            className="btn-action-delete"
                                            onClick={() => handleDeleteClick(admin)}
                                            title="Delete Admin"
                                            style={{
                                                color: 'var(--red)',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '6px',
                                                opacity: 0.6,
                                                transition: 'all 0.2s',
                                                borderRadius: '6px'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(244,67,54,0.1)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / Edit Admin Modal */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} style={{ maxWidth: '440px' }}>
                <div className="modal-hd">
                    <div>
                        <div className="modal-title">{editingId ? 'Edit Admin Account' : 'Create Admin Account'}</div>
                        <div className="modal-sub">{editingId ? 'Update login credentials for this system administrator' : 'Set up login credentials for a new system administrator'}</div>
                    </div>
                    <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
                </div>
                <div className="f-group">
                    <label className="f-label">Username</label>
                    <input className="f-input" type="text" placeholder="e.g. admin.boss" value={admUser} onChange={(e) => setAdmUser(e.target.value)} autoComplete="off" />
                </div>
                <div className="f-group">
                    <label className="f-label">
                        Password {editingId && <span style={{ fontSize: '11px', color: 'var(--gray)', fontWeight: 400 }}>(Leave blank to keep current)</span>}
                    </label>
                    <input className="f-input" type="password" placeholder={editingId ? '••••••••' : 'Enter password'} value={admPass} onChange={(e) => setAdmPass(e.target.value)} />
                </div>
                {formError && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '13px', fontFamily: 'var(--fm)' }}>
                        {formError}
                    </div>
                )}
                <div className="modal-actions">
                    <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Create Admin'}
                    </button>
                    <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                </div>
            </Modal>

            {/* Confirm Delete */}
            <ConfirmModal
                open={confirmOpen}
                onClose={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
                onConfirm={handleDelete}
                message={`Delete administrator account <strong>@${pendingDeleteUser}</strong>?<br>They will lose complete platform access immediately.`}
                loading={deleting}
            />
        </div>
    );
}
