import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function AdminLogin({ onBack, onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const showToast = useToast();

    async function handleLogin() {
        if (!username.trim() || !password) return;
        setLoading(true);
        try {
            const data = await api('POST', '/api/auth/admin', { username: username.trim(), password });
            setError(false);
            onLogin(data.token, { type: 'admin' });
        } catch {
            setError(true);
            setPassword('');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="view active lp-root" id="v-admin-login">
            <div className="login-box">
                <div className="login-icon-wrap">
                    <svg viewBox="0 0 24 24"><path d="M12 2l7 4v5c0 5-3.5 9.74-7 11-3.5-1.26-7-6-7-11V6l7-4z" /><polyline points="9 12 11 14 15 10" /></svg>
                </div>
                <div className="login-title">ADMIN <span className="y">LOGIN</span></div>
                <div className="login-subtitle">Enter your admin credentials to continue</div>
                <div className="f-group">
                    <label className="f-label">Username</label>
                    <input className="f-input" type="text" placeholder="admin" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="f-group">
                    <label className="f-label">Password</label>
                    <div className="f-input-wrap">
                        <input className="f-input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                        <button className="f-pwd-toggle" type="button" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? (
                                <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
                            ) : (
                                <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            )}
                        </button>
                    </div>
                    <div className={'f-error' + (error ? ' show' : '')}>Incorrect username or password.</div>
                </div>
                <button className="btn-login" onClick={handleLogin} disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
                </button>
            </div>
        </div>
    );
}
