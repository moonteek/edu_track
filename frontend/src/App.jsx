import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import AdminLogin from './pages/AdminLogin';
import AdminApp from './pages/AdminApp';
import NotFound from './pages/NotFound';
import { isTokenExpired } from './api';

function AppContent() {
    const [token, setToken] = useState(() => {
        const savedToken = localStorage.getItem('token');
        if (isTokenExpired(savedToken)) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return null;
        }
        return savedToken;
    });
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch {
            return null;
        }
    });

    const navigate = useNavigate();

    function handleLogin(newToken, newUser) {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        navigate('/admin');
    }

    function handleLogout() {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/admin/login');
    }

    return (
        <Routes>
            <Route path="/admin/login" element={
                user?.type === 'admin' ? <Navigate to="/admin" replace /> :
                    <AdminLogin onLogin={handleLogin} />
            } />
            <Route path="/admin/*" element={
                (token && user?.type === 'admin') ?
                    <AdminApp token={token} onLogout={handleLogout} /> :
                    <Navigate to="/admin/login" replace />
            } />
            <Route path="/" element={<Navigate to="/admin/login" replace />} />
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AppContent />
            </ToastProvider>
        </BrowserRouter>
    );
}
