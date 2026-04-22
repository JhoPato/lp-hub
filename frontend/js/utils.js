export function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeFromNow(dateStr) {
    const diff = new Date(dateStr) - new Date();
    const abs  = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    const hrs  = Math.floor(abs / 3600000);
    const days = Math.floor(abs / 86400000);
    const past = diff < 0;
    if (mins < 60)  return past ? `${mins}m ago`  : `in ${mins}m`;
    if (hrs  < 24)  return past ? `${hrs}h ago`   : `in ${hrs}h`;
    return past ? `${days}d ago` : `in ${days}d`;
}

export function toast(msg, type = 'default') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast${type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : ''}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

export function badge(text, type) {
    return `<span class="badge badge-${type}">${text}</span>`;
}

function svgIcon(...paths) {
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" style="flex-shrink:0;">${
        paths.map(d => `<path stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`).join('')
    }</svg>`;
}

const I = {
    dashboard:     svgIcon(`M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z`),
    announcements: svgIcon(`M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46`),
    tasks:         svgIcon(`M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z`),
    schedule:      svgIcon(`M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z`),
    pracc:         svgIcon(`M2.25 10.5A4.5 4.5 0 016.75 6h10.5a4.5 4.5 0 014.5 4.5v3a4.5 4.5 0 01-4.5 4.5H6.75a4.5 4.5 0 01-4.5-4.5v-3z`, `M8.25 12h1.5m-.75-.75v1.5m6.75-.75h.008v.008H15v-.008zm1.5 0h.008v.008h-.008v-.008z`),
    praccStats:    svgIcon(`M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z`),
    gallery:       svgIcon(`M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z`),
    players:       svgIcon(`M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z`),
    invites:       svgIcon(`M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z`),
    settings:      svgIcon(`M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z`, `M15 12a3 3 0 11-6 0 3 3 0 016 0z`),
    profile:       svgIcon(`M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z`),
    board:         svgIcon(`M3 4.5l6-1.5 6 1.5 6-1.5V19.5l-6 1.5-6-1.5-6 1.5V4.5z`, `M9 6.75V15m6-6v8.25`),
    individual:    svgIcon(`M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941`),
    managers:      svgIcon(`M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z`),
    news:          svgIcon(`M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z`),
    assets:        svgIcon(`M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z`),
    about:         svgIcon(`M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0`),
    rosters:       svgIcon(`M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z`),
    clips:         svgIcon(`M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z`),
    link:          svgIcon(`M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244`),
    globe:         svgIcon(`M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418`),
    cobblemon:     svgIcon(`M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z`),
    teamStats:     svgIcon(`M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z`),
    logout:        svgIcon(`M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9`),
    eye:           svgIcon(`M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z`, `M15 12a3 3 0 11-6 0 3 3 0 016 0z`),
};

window.__logout = function() { import('/js/api.js').then(m => m.logout()); };

window.__toggleTeamSwitcher = function() {
    const m = document.getElementById('teamSwitcherMenu');
    if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
};

window.__switchTeam = async function(teamId) {
    try {
        const token = localStorage.getItem('lp_hub_token');
        const res = await fetch('/api/auth/switch-team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ teamId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        localStorage.setItem('lp_hub_token', d.token);
        localStorage.setItem('lp_hub_user', JSON.stringify(d.user));
        const role = d.user.role;
        if (role === 'owner') location.href = '/owner/dashboard.html';
        else if (role === 'manager') location.href = '/manager/dashboard.html';
        else location.href = '/player/dashboard.html';
    } catch (err) {
        alert('Failed to switch team: ' + err.message);
    }
};

document.addEventListener('click', function(e) {
    const wrap = document.getElementById('teamSwitcherWrap');
    const menu = document.getElementById('teamSwitcherMenu');
    if (wrap && menu && !wrap.contains(e.target)) menu.style.display = 'none';
});

// Fix: prevent modal-overlay from closing when user drags text selection
// outside the modal box. Track whether mousedown started inside .modal-box;
// if so, suppress the overlay onclick that would fire after the drag ends.
(function() {
    let _mousedownInsideBox = false;
    document.addEventListener('mousedown', function(e) {
        _mousedownInsideBox = !!e.target.closest('.modal-box');
    }, true);
    document.addEventListener('click', function(e) {
        if (_mousedownInsideBox && e.target.closest('.modal-overlay') && !e.target.closest('.modal-box')) {
            e.stopImmediatePropagation();
        }
    }, true);
})();

setTimeout(async () => {
    try {
        const token = localStorage.getItem('lp_hub_token');
        if (!token) return;
        const r = await fetch('/api/auth/my-teams', { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return;
        const { teams } = await r.json();

        localStorage.setItem('lp_hub_teams', JSON.stringify(teams || []));

        const wrap = document.getElementById('teamSwitcherWrap');

        if (!teams || teams.length < 2) {
            if (wrap) wrap.remove();
            return;
        }

        const menuHtml = teams.map(t =>
            `<button onclick="window.__switchTeam('${t.id}')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border);padding:10px 14px;cursor:pointer;color:var(--text);font-size:0.8rem;" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='none'">
                <span style="font-weight:700;">${t.name}</span>
                <span style="color:var(--text-muted);font-size:0.7rem;margin-left:6px;">${t.role}</span>
            </button>`
        ).join('');

        if (wrap) {
            const menu = document.getElementById('teamSwitcherMenu');
            if (menu) menu.innerHTML = menuHtml;
            return;
        }

        const nameArea = document.querySelector('.sidebar-team');
        if (!nameArea) return;
        nameArea.insertAdjacentHTML('beforeend', `<div id="teamSwitcherWrap" style="position:relative;display:inline-block;">
            <button onclick="window.__toggleTeamSwitcher()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.75rem;padding:2px 4px;line-height:1;vertical-align:middle;margin-left:4px;" title="Switch team">⇄</button>
            <div id="teamSwitcherMenu" style="display:none;position:absolute;left:0;top:calc(100% + 4px);min-width:180px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:999;overflow:hidden;">
                ${menuHtml}
            </div>
        </div>`);
    } catch {}
}, 80);

function navSection(label) {
    return `<div style="font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);padding:14px 16px 4px;opacity:0.6;">${label}</div>`;
}

function avatarHtml(user, fallbackLetter) {
    if (user.discordAvatar) return `<img src="${user.discordAvatar}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    return (user.username || fallbackLetter).slice(0, 2).toUpperCase();
}

export function buildSidebar(role, activePage) {
    const user = JSON.parse(localStorage.getItem('lp_hub_user') || '{}');

    if (role === 'social') {
        const socialNav = [
            { icon: I.news,       label: 'News',          href: '/social/news.html',          key: 'news' },
            { icon: I.assets,     label: 'Assets',        href: '/social/assets.html',        key: 'assets' },
            { icon: I.schedule,   label: 'Next Matches',  href: '/social/next-matches.html',  key: 'next-matches' },
            { icon: I.cobblemon,  label: 'Cobblemon',     href: '/social/cobblemon.html',     key: 'cobblemon' },
            { icon: I.profile,    label: 'My Profile',    href: '/social/profile.html',       key: 'profile' },
        ];
        return `
            <div class="sidebar-logo">LOST PUPPIES <span>HUB</span>
                <div class="sidebar-team" id="sidebarTeamName">Social</div>
            </div>
            <nav class="sidebar-nav" id="sidebarNav">
                ${navSection('Public Site')}
                ${socialNav.map(n => `
                    <a href="${n.href}" class="${activePage === n.key ? 'active' : ''}" data-nav-key="${n.key}">
                        <span class="nav-icon">${n.icon}</span><span class="nav-label-wrap">${n.label}</span>
                    </a>`).join('')}
            </nav>
            <div class="sidebar-user">
                <div class="user-avatar" id="sidebarAvatar">${avatarHtml(user, 'S')}</div>
                <div class="user-info">
                    <div class="user-name">${user.username || '—'}</div>
                    <div class="user-role">social</div>
                </div>
                <button class="btn-logout" title="Logout" onclick="window.__logout()">${I.logout}</button>
            </div>`;
    }

    if (role === 'owner') {
        return `
            <div class="sidebar-logo">LOST PUPPIES <span>HUB</span>
                <div class="sidebar-team" id="sidebarTeamName">Owner</div>
            </div>
            <nav class="sidebar-nav" id="sidebarNav">
                ${navSection('Hub')}
                <a href="/owner/dashboard.html" class="${activePage==='dashboard'?'active':''}" data-nav-key="dashboard">
                    <span class="nav-icon">${I.globe}</span><span class="nav-label-wrap">Dashboard</span>
                </a>
                <a href="/owner/teams.html" class="${activePage==='teams'?'active':''}" data-nav-key="teams">
                    <span class="nav-icon">${I.players}</span><span class="nav-label-wrap">Teams</span>
                </a>
                <a href="/owner/managers.html" class="${activePage==='managers'?'active':''}" data-nav-key="managers">
                    <span class="nav-icon">${I.managers}</span><span class="nav-label-wrap">Managers</span>
                </a>
                <a href="/owner/team-stats.html" class="${activePage==='team-stats'?'active':''}" data-nav-key="team-stats">
                    <span class="nav-icon">${I.teamStats}</span><span class="nav-label-wrap">Team Stats</span>
                </a>
                ${navSection('Public Site')}
                <a href="/manager/site-news.html" class="${activePage==='site-news'?'active':''}" data-nav-key="site-news">
                    <span class="nav-icon">${I.news}</span><span class="nav-label-wrap">News</span>
                </a>
                <a href="/social/assets.html" class="${activePage==='assets'?'active':''}" data-nav-key="assets">
                    <span class="nav-icon">${I.assets}</span><span class="nav-label-wrap">Assets & Gallery</span>
                </a>
                <a href="/manager/site-about.html" class="${activePage==='site-about'?'active':''}" data-nav-key="site-about">
                    <span class="nav-icon">${I.about}</span><span class="nav-label-wrap">Staff & Trophies</span>
                </a>
                <a href="/manager/site-roster.html" class="${activePage==='site-roster'?'active':''}" data-nav-key="site-roster">
                    <span class="nav-icon">${I.rosters}</span><span class="nav-label-wrap">Rosters</span>
                </a>
                <a href="/manager/clips.html" class="${activePage==='clips'?'active':''}" data-nav-key="clips">
                    <span class="nav-icon">${I.clips}</span><span class="nav-label-wrap">Clips — Fanbase</span>
                </a>
                <a href="/social/next-matches.html" class="${activePage==='next-matches'?'active':''}" data-nav-key="next-matches">
                    <span class="nav-icon">${I.schedule}</span><span class="nav-label-wrap">Next Matches</span>
                </a>
                <a href="/social/cobblemon.html" class="${activePage==='cobblemon'?'active':''}" data-nav-key="cobblemon">
                    <span class="nav-icon">${I.cobblemon}</span><span class="nav-label-wrap">Cobblemon</span>
                </a>
                ${navSection('Access')}
                <a href="/manager/invites.html" class="${activePage==='invites'?'active':''}" data-nav-key="invites">
                    <span class="nav-icon">${I.link}</span><span class="nav-label-wrap">Invites</span>
                </a>
                ${navSection('Account')}
                <a href="/social/profile.html" class="${activePage==='profile'?'active':''}" data-nav-key="profile">
                    <span class="nav-icon">${I.profile}</span><span class="nav-label-wrap">My Profile</span>
                </a>
            </nav>
            <div class="sidebar-user">
                <div class="user-avatar" id="sidebarAvatar">${avatarHtml(user, 'O')}</div>
                <div class="user-info">
                    <div class="user-name">${user.username || '—'}</div>
                    <div class="user-role">owner</div>
                </div>
                <button class="btn-logout" title="Logout" onclick="window.__logout()">${I.logout}</button>
            </div>`;
    }

    const base = role === 'manager' ? '/manager' : '/player';

    function navLink(icon, label, href, key) {
        return `<a href="${href}" class="${activePage === key ? 'active' : ''}" data-nav-key="${key}"${activePage === key ? ' onclick="return false"' : ''}>
            <span class="nav-icon">${icon}</span><span class="nav-label-wrap">${label}</span>
        </a>`;
    }

    const managerNav = `
        ${navSection('Overview')}
        ${navLink(I.dashboard,     'Dashboard',     `${base}/dashboard.html`,     'dashboard')}
        ${navSection('Team')}
        ${navLink(I.announcements, 'Announcements', `${base}/announcements.html`, 'announcements')}
        ${navLink(I.tasks,         'Tasks',          `${base}/tasks.html`,         'tasks')}
        ${navLink(I.schedule,      'Schedule',       `${base}/schedule.html`,      'schedule')}
        ${navSection('Competitive')}
        ${navLink(I.pracc,         'Pracc History',  `${base}/pracc.html`,              'pracc')}
        ${navLink(I.praccStats,    'Pracc Stats',    `${base}/pracc-stats.html`,        'pracc-stats')}
        ${navLink(I.board,         'Strategy Board', `/manager/strategies.html`,          'strategy-board')}
        ${navLink(I.individual,    'Individual',     `/manager/player-goals.html`,        'player-goals')}
        ${navSection('Media')}
        ${navLink(I.gallery,       'Gallery',        `${base}/gallery.html`,       'gallery')}
        ${navSection('Management')}
        ${navLink(I.players,       'Players',        `${base}/players.html`,       'players')}
        ${navLink(I.invites,       'Invite Codes',   `${base}/invites.html`,       'invites')}
        ${navLink(I.settings,      'Team Settings',  `${base}/team-settings.html`, 'settings')}
        ${navSection('Account')}
        ${navLink(I.profile,       'My Profile',     `${base}/profile.html`,       'profile')}
    `;

    const playerNav = `
        ${navSection('Overview')}
        ${navLink(I.dashboard,     'Dashboard',     `${base}/dashboard.html`,     'dashboard')}
        ${navSection('Team')}
        ${navLink(I.announcements, 'Announcements', `${base}/announcements.html`, 'announcements')}
        ${navLink(I.tasks,         'Tasks',          `${base}/tasks.html`,         'tasks')}
        ${navLink(I.schedule,      'Schedule',       `${base}/schedule.html`,      'schedule')}
        ${navSection('Competitive')}
        ${navLink(I.pracc,         'Pracc History',  `${base}/pracc.html`,              'pracc')}
        ${navLink(I.praccStats,    'Pracc Stats',    `${base}/pracc-stats.html`,        'pracc-stats')}
        ${navLink(I.board,         'Strategy Board', `/manager/strategies.html`,          'strategy-board')}
        ${navLink(I.individual,    'Individual',     `/manager/player-goals.html`,        'player-goals')}
        ${navSection('Media')}
        ${navLink(I.gallery,       'Gallery',        `${base}/gallery.html`,       'gallery')}
        ${navSection('Account')}
        ${navLink(I.profile,       'My Profile',     `${base}/profile.html`,       'profile')}
    `;

    const ownerToken = localStorage.getItem('lp_hub_owner_token');
    const impersonatingBanner = ownerToken ? `
        <div style="background:rgba(223,88,64,0.15);border-bottom:1px solid rgba(223,88,64,0.3);padding:8px 14px;font-size:0.72rem;color:var(--accent);display:flex;align-items:center;justify-content:space-between;">
            <span style="display:flex;align-items:center;gap:6px;">${I.eye} Owner View</span>
            <button onclick="(function(){localStorage.setItem('lp_hub_token',localStorage.getItem('lp_hub_owner_token'));localStorage.setItem('lp_hub_user',localStorage.getItem('lp_hub_owner_user'));localStorage.removeItem('lp_hub_owner_token');localStorage.removeItem('lp_hub_owner_user');window.location.href='/owner/teams.html';})()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.78rem;font-weight:700;">← Back</button>
        </div>` : '';

    const allTeams = JSON.parse(localStorage.getItem('lp_hub_teams') || '[]');
    const switcherHtml = allTeams.length > 1 ? `
        <div id="teamSwitcherWrap" style="position:relative;display:inline-block;">
            <button id="teamSwitcherBtn" title="Switch Team" onclick="window.__toggleTeamSwitcher()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.75rem;padding:2px 4px;line-height:1;vertical-align:middle;margin-left:4px;">⇄</button>
            <div id="teamSwitcherMenu" style="display:none;position:absolute;left:0;top:calc(100% + 4px);min-width:180px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:999;overflow:hidden;">
                ${allTeams.map(t => `
                    <button onclick="window.__switchTeam('${t.id}')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border);padding:10px 14px;cursor:pointer;color:var(--text);font-size:0.8rem;" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='none'">
                        <span style="font-weight:700;">${t.name}</span>
                        <span style="color:var(--text-muted);font-size:0.7rem;margin-left:6px;">${t.role}</span>
                    </button>`).join('')}
            </div>
        </div>` : '';

    return `
        ${impersonatingBanner}
        <div class="sidebar-logo">LOST PUPPIES <span>HUB</span>
            <div class="sidebar-team" style="display:flex;align-items:center;gap:2px;">
                <span id="sidebarTeamName">Loading...</span>
                ${switcherHtml}
            </div>
        </div>
        <nav class="sidebar-nav" id="sidebarNav">
            ${role === 'manager' ? managerNav : playerNav}
        </nav>
        <div class="sidebar-user">
            <div class="user-avatar" id="sidebarAvatar">${avatarHtml(user, 'U')}</div>
            <div class="user-info">
                <div class="user-name">${user.username || '—'}</div>
                <div class="user-role">${user.role || ''}</div>
            </div>
            <button class="btn-logout" title="Logout" onclick="window.__logout()">${I.logout}</button>
        </div>`;
}

export async function updateNotificationBadges(apiModule) {
    try {
        const lastSeen = parseInt(localStorage.getItem('lpHub_lastSeenAnn') || '0', 10);
        const { items } = await apiModule.api('/api/announcements?limit=50');
        const unread = items.filter(a => new Date(a.createdAt).getTime() > lastSeen).length;
        if (unread > 0) {
            const link = document.querySelector('[data-nav-key="announcements"] .nav-label-wrap');
            if (link) link.insertAdjacentHTML('beforeend', `<span class="nav-badge">${unread > 99 ? '99+' : unread}</span>`);
        }
    } catch {}
}
