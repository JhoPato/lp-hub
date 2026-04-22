const DISMISS_KEY = 'lp_discord_notify_dismissed';

if (!sessionStorage.getItem(DISMISS_KEY)) {
    const token = localStorage.getItem('lp_hub_token');
    if (token) {
        fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
            .then(r => r.ok ? r.json() : null)
            .then(me => {
                if (!me || me.discordId) return;

                const role = me.role || '';
                const profilePath =
                    role === 'manager'                    ? '/manager/profile.html' :
                    role === 'social' || role === 'owner' ? '/social/profile.html'  :
                    '/player/profile.html';

                const el = document.createElement('div');
                el.className = 'discord-notify';
                el.innerHTML =
                    '<svg width="20" height="16" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0" aria-hidden="true"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.4a.2.2 0 0 0-.2.1 40.7 40.7 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.5 37.5 0 0 0 25.5.5a.2.2 0 0 0-.2-.1 58.4 58.4 0 0 0-14.6 4.5.2.2 0 0 0-.1.1C1.6 18.7-.9 32.2.3 45.5a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 8.9.2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.8a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.3 0a.2.2 0 0 1 .3 0l1 .9a.2.2 0 0 1 0 .4 36 36 0 0 1-5.5 2.6.2.2 0 0 0-.1.3c1 2 2.2 4 3.6 5.9a.2.2 0 0 0 .3.1 58.6 58.6 0 0 0 17.8-8.9.2.2 0 0 0 .1-.2c1.5-15.3-2.5-28.7-10.5-40.5a.2.2 0 0 0-.1-.1ZM23.7 37.7c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Z" fill="currentColor"/></svg>' +
                    '<span>Add your Discord to enable Discord login. <a href="' + profilePath + '">Link now</a></span>' +
                    '<button class="discord-notify-close" aria-label="Dismiss">✕</button>';

                document.body.appendChild(el);

                el.querySelector('.discord-notify-close').addEventListener('click', () => {
                    sessionStorage.setItem(DISMISS_KEY, '1');
                    el.remove();
                });
            })
            .catch(() => {});
    }
}
