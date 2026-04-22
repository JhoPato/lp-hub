const express    = require('express');
const axios      = require('axios');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const router     = express.Router();
const User       = require('../models/User');
const InviteCode = require('../models/InviteCode');
const { authMiddleware } = require('../middleware/auth');

const DISCORD_API = 'https://discord.com/api/v10';
const _states     = new Map();

function signToken(user) {
    return jwt.sign(
        { userId: user._id, teamId: user.teamId, role: user.role, siteTeam: user.siteTeam },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function cleanStates() {
    const now = Date.now();
    for (const [k, v] of _states) {
        if (v.exp < now) _states.delete(k);
    }
}

function errRedirect(res, page, code, st) {
    if (st && st.source === 'desktop' && st.desktopPort)
        return res.redirect(`http://127.0.0.1:${st.desktopPort}/discord-callback?discord_error=${encodeURIComponent(code)}`);
    return res.redirect(`/${page}?discord_error=${encodeURIComponent(code)}`);
}

function successRedirect(res, page, token, role, st) {
    if (st && st.source === 'desktop' && st.desktopPort)
        return res.redirect(`http://127.0.0.1:${st.desktopPort}/discord-callback?discord_token=${encodeURIComponent(token)}&role=${role}`);
    return res.redirect(`/${page}?discord_token=${encodeURIComponent(token)}&role=${role}`);
}

router.get('/discord', (req, res) => {
    const { action = 'login', inviteCode, token, source } = req.query;

    if (!['login', 'register', 'link'].includes(action))
        return res.status(400).send('Invalid action.');

    let userId = null;
    if (action === 'link') {
        const raw = token || (req.headers.authorization || '').replace('Bearer ', '');
        if (!raw) return res.status(401).send('Not authenticated.');
        try {
            userId = jwt.verify(raw, process.env.JWT_SECRET).userId;
        } catch {
            return res.status(401).send('Invalid token.');
        }
    }

    const desktopPort = source === 'desktop' ? parseInt(req.query.port, 10) || null : null;

    cleanStates();
    const nonce = crypto.randomBytes(16).toString('hex');
    _states.set(nonce, {
        action,
        inviteCode: inviteCode ? inviteCode.toUpperCase() : null,
        userId,
        source: source === 'desktop' ? 'desktop' : 'web',
        desktopPort,
        exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI2,
        response_type: 'code',
        scope:         'identify email',
        state:         nonce,
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error)           return errRedirect(res, 'login.html', error);
    if (!code || !state) return errRedirect(res, 'login.html', 'missing_params');

    cleanStates();
    const st = _states.get(state);
    if (!st) return errRedirect(res, 'login.html', 'invalid_state', null);
    _states.delete(state);

    try {
        const tokenRes = await axios.post(
            `${DISCORD_API}/oauth2/token`,
            new URLSearchParams({
                client_id:     process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type:    'authorization_code',
                code,
                redirect_uri:  process.env.DISCORD_REDIRECT_URI2,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = tokenRes.data;

        const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const dUser = userRes.data;

        if (st.action === 'login') {
            const user = await User.findOne({ discordId: dUser.id });
            if (!user)          return errRedirect(res, 'login.html', 'no_account', st);
            if (!user.isActive) return errRedirect(res, 'login.html', 'deactivated', st);

            const tkn = signToken(user);
            return successRedirect(res, 'login.html', tkn, user.role, st);
        }

        if (st.action === 'register') {
            if (!st.inviteCode) return errRedirect(res, 'register.html', 'no_invite', st);

            const invite = await InviteCode.findOne({ code: st.inviteCode, isUsed: false });
            if (!invite)                       return errRedirect(res, 'register.html', 'invalid_invite', st);
            if (new Date() > invite.expiresAt) return errRedirect(res, 'register.html', 'expired_invite', st);

            const existing = await User.findOne({ discordId: dUser.id });
            if (existing) {
                const tkn = signToken(existing);
                return successRedirect(res, 'login.html', tkn, existing.role, st);
            }

            const email      = dUser.email ? dUser.email.toLowerCase() : `discord_${dUser.id}@noemail.lphub`;
            const emailUser  = await User.findOne({ email });
            const isTeamless = ['social', 'owner'].includes(invite.role);

            let user;
            if (emailUser) {
                emailUser.discordId       = dUser.id;
                emailUser.discordUsername = dUser.username;
                emailUser.discordAvatar   = dUser.avatar ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=128` : null;
                await emailUser.save();
                user = emailUser;
            } else {
                user = await User.create({
                    username:        dUser.global_name || dUser.username,
                    email,
                    passwordHash:    User.hashPassword(crypto.randomBytes(24).toString('hex')),
                    discordId:       dUser.id,
                    discordUsername: dUser.username,
                    discordAvatar:   dUser.avatar ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=128` : null,
                    role:    invite.role,
                    teamId:  isTeamless ? null : invite.teamId,
                    teamIds: isTeamless ? []   : [invite.teamId],
                    siteTeam: invite.siteTeam || { region: null, teamIndex: null },
                });
            }

            invite.isUsed = true;
            invite.usedBy = user._id;
            invite.usedAt = new Date();
            await invite.save();

            const tkn = signToken(user);
            return successRedirect(res, 'login.html', tkn, user.role, st);
        }

        if (st.action === 'link') {
            const user = await User.findById(st.userId);
            if (!user) return errRedirect(res, 'manager/profile.html', 'user_not_found', null);

            const conflict = await User.findOne({ discordId: dUser.id, _id: { $ne: st.userId } });
            if (conflict) return errRedirect(res, 'manager/profile.html', 'discord_taken', null);

            user.discordId       = dUser.id;
            user.discordUsername = dUser.username;
            user.discordAvatar   = dUser.avatar ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=128` : null;
            await user.save();

            return res.redirect('/manager/profile.html?discord_linked=1');
        }
    } catch (err) {
        console.error('[discord/callback]', err.response?.data || err.message);
        const page = st.action === 'link' ? 'manager/profile.html' : 'login.html';
        return errRedirect(res, page, 'server_error', st);
    }
});

router.post('/discord/unlink', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        user.discordId       = null;
        user.discordUsername = null;
        await user.save();

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
