// In production, set VITE_API_URL in your hosting provider's env vars (e.g. Vercel).
// In dev, Vite proxies /api to localhost:5000 so no base URL is needed.
const API_BASE = import.meta.env.VITE_API_URL || '';

/** Returns true if the JWT token is missing or its exp has already passed. */
export function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // exp is in seconds; Date.now() is in milliseconds
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
}

/**
 * @param {string} method
 * @param {string} path
 * @param {object|null} body
 * @param {string|null} token
 * @param {Function|null} onUnauthorized - called when the server returns 401 (expired/invalid token)
 */
export async function api(method, path, body, token, onUnauthorized = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        cache: 'no-store',
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json();
    if (res.status === 401 && onUnauthorized) {
        onUnauthorized();
        throw new Error(data.error || 'Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    return data;
}
