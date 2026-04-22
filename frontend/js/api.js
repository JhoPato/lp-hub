const BASE = '';

export async function api(path, options = {}) {
    const token = localStorage.getItem('lp_hub_token');
    const timeoutMs = options._timeout ?? 30000; // 30s default; pass _timeout:0 to disable
    const controller = new AbortController();
    const tid = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const res = await fetch(BASE + path, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {}),
            },
        });
        if (tid) clearTimeout(tid);
        const data = await res.json();
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('lp_hub_token');
            localStorage.removeItem('lp_hub_user');
            localStorage.removeItem('lp_hub_teams');
            window.location.href = '/login.html?session_expired=1';
            return;
        }
        if (!res.ok) throw new Error(data.error || 'Request failed.');
        return data;
    } catch (err) {
        if (tid) clearTimeout(tid);
        if (err.name === 'AbortError') throw new Error('Request timed out — server took too long to respond.');
        throw err;
    }
}

export function getUser() {
    return JSON.parse(localStorage.getItem('lp_hub_user') || 'null');
}

export function logout() {
    localStorage.removeItem('lp_hub_token');
    localStorage.removeItem('lp_hub_user');
    localStorage.removeItem('lp_hub_teams');
    window.location.href = '/login.html';
}

export function requireAuth(allowedRoles = []) {
    const token = localStorage.getItem('lp_hub_token');
    const user  = getUser();
    if (!token || !user) { window.location.href = '/login.html'; return null; }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        if (user.role === 'owner')   window.location.href = '/owner/dashboard.html';
        else if (user.role === 'manager') window.location.href = '/manager/dashboard.html';
        else if (user.role === 'social')  window.location.href = '/social/news.html';
        else window.location.href = '/player/dashboard.html';
        return null;
    }
    return user;
}
