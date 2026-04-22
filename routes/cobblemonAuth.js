// routes/cobblemonAuth.js
// Discord OAuth2 + Cobblemon player registration
// Env vars needed:
//   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
//   DISCORD_REDIRECT_URI  (e.g. https://lphub.discloud.app/api/cobblemon/auth/callback)
//   COBBLEMON_SITE_URL    (e.g. https://cobblemon.lostpuppies.org)
//   JWT_SECRET            (shared with the rest of LP-Hub)

require('dotenv').config();
const express  = require('express');
const axios    = require('axios');
const jwt      = require('jsonwebtoken');
const router   = express.Router();

const CobblemonPlayer       = require('../models/CobblemonPlayer');
const CobblemonRegistration = require('../models/CobblemonRegistration');
const CobblemonConfig       = require('../models/CobblemonConfig');

const LP_API_URL   = process.env.LP_API_URL   || 'https://applostpuppies.discloud.app';
const LP_API_TOKEN = process.env.LPAPI_OWNER_TOKEN || '';
const DEFAULT_LEAGUE_DATA = {
    season: 1,
    registration: {
        status: 'coming_soon',
        maxParticipants: 16,
        currentParticipants: 0,
        discordLink: '',
        formLink: '',
    },
};

// ── JWT helpers ───────────────────────────────────────────────────────────────
function signToken(player) {
    return jwt.sign(
        { discordId: player.discordId, discordUsername: player.discordUsername },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });
    try {
        req.player = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

// ── Sync registrations to LP-API ──────────────────────────────────────────────
async function syncPlayersToLpApi(season) {
    if (!LP_API_TOKEN) return;
    try {
        const regs = await CobblemonRegistration.find({ season, status: { $ne: 'withdrawn' } })
            .sort({ registeredAt: 1 })
            .lean();

        const players = regs.map(r => ({
            discordId:         r.discordId,
            discordUsername:   r.discordUsername,
            discordAvatar:     r.discordAvatar,
            minecraftUsername: r.minecraftUsername,
            minecraftUUID:     r.minecraftUUID,
            status:            r.status,
            registeredAt:      r.registeredAt,
        }));

        await axios.post(`${LP_API_URL}/api/manage-cobblemon`, {
            token:  LP_API_TOKEN,
            action: 'save-players',
            data:   { season, players }
        });
    } catch (err) {
        console.warn('[CobblemonAuth] LP-API player sync failed:', err.message);
    }
}

async function getLeagueConfigData() {
    const doc = await CobblemonConfig.findOne({ type: 'league' }).lean();
    return doc?.data || DEFAULT_LEAGUE_DATA;
}

async function updateRegistrationCount(season) {
    const currentParticipants = await CobblemonRegistration.countDocuments({
        season,
        status: { $ne: 'withdrawn' }
    });

    await CobblemonConfig.findOneAndUpdate(
        { type: 'league' },
        {
            $set: { 'data.registration.currentParticipants': currentParticipants },
            $setOnInsert: { type: 'league', data: DEFAULT_LEAGUE_DATA },
        },
        { upsert: true, new: true }
    );

    return currentParticipants;
}

// ── GET /api/cobblemon/auth/discord — redirect to Discord OAuth ───────────────
router.get('/auth/discord', (req, res) => {
    const params = new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope:         'identify',
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// ── GET /api/cobblemon/auth/callback — Discord returns here ───────────────────
router.get('/auth/callback', async (req, res) => {
    const SITE = process.env.COBBLEMON_SITE_URL || 'https://cobblemon.lostpuppies.org';
    const { code, error } = req.query;
    if (error || !code) return res.redirect(`${SITE}/league/?auth=error`);

    try {
        // Exchange code for access token
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id:     process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type:    'authorization_code',
                code,
                redirect_uri:  process.env.DISCORD_REDIRECT_URI,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenRes.data.access_token;

        // Fetch Discord user info
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const { id, username, global_name, avatar } = userRes.data;
        const displayName = global_name || username;

        // Upsert player in MongoDB — use $set to preserve minecraftUsername/UUID
        const player = await CobblemonPlayer.findOneAndUpdate(
            { discordId: id },
            { $set: {
                discordId:       id,
                discordUsername: displayName,
                discordAvatar:   avatar || '',
            }},
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const token = signToken(player);
        res.redirect(`${SITE}/league/?auth=ok&token=${token}`);
    } catch (err) {
        console.error('[CobblemonAuth] OAuth callback error:', err.message);
        res.redirect(`${SITE}/league/?auth=error`);
    }
});

// ── GET /api/cobblemon/auth/me — return current player profile ────────────────
router.get('/auth/me', authMiddleware, async (req, res) => {
    try {
        const player = await CobblemonPlayer.findOne({ discordId: req.player.discordId }).lean();
        if (!player) return res.status(404).json({ error: 'Player not found.' });
        res.json({ player });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/cobblemon/auth/minecraft — link Minecraft account ────────────────
router.put('/auth/minecraft', authMiddleware, async (req, res) => {
    const { minecraftUsername } = req.body;
    if (!minecraftUsername?.trim()) return res.status(400).json({ error: 'minecraftUsername required.' });

    try {
        // Validate username exists via Mojang API
        const mojangRes = await axios.get(
            `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftUsername.trim())}`,
            { timeout: 5000 }
        );
        const { id: rawUUID, name } = mojangRes.data;
        // Insert dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        const uuid = rawUUID.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');

        const player = await CobblemonPlayer.findOneAndUpdate(
            { discordId: req.player.discordId },
            { minecraftUsername: name, minecraftUUID: uuid },
            { new: true }
        );

        res.json({ player });
    } catch (err) {
        if (err.response?.status === 404) {
            return res.status(404).json({ error: `Minecraft username "${minecraftUsername}" not found.` });
        }
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/cobblemon/register — join current season ───────────────────────
router.post('/register', authMiddleware, async (req, res) => {
    try {
        const player = await CobblemonPlayer.findOne({ discordId: req.player.discordId }).lean();
        if (!player) return res.status(404).json({ error: 'Player not found.' });
        if (!player.minecraftUsername) return res.status(400).json({ error: 'Link your Minecraft account first.' });

        // Get current season from CobblemonConfig
        const league = await getLeagueConfigData();
        const season = league?.season ?? 1;
        const regStatus = league?.registration?.status;
        if (regStatus !== 'open') return res.status(400).json({ error: 'Registrations are not open.' });

        const maxSlots = league?.registration?.maxParticipants ?? 16;
        const currentCount = await CobblemonRegistration.countDocuments({
            season, status: { $ne: 'withdrawn' }
        });
        if (currentCount >= maxSlots) return res.status(400).json({ error: 'Tournament is full.' });

        const reg = await CobblemonRegistration.findOneAndUpdate(
            { discordId: player.discordId, season },
            {
                discordId:         player.discordId,
                season,
                discordUsername:   player.discordUsername,
                discordAvatar:     player.discordAvatar,
                minecraftUsername: player.minecraftUsername,
                minecraftUUID:     player.minecraftUUID,
                status:            'registered',
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Update currentParticipants in CobblemonConfig
        const newCount = await updateRegistrationCount(season);

        await syncPlayersToLpApi(season);
        res.json({ registration: reg, currentParticipants: newCount });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ error: 'Already registered for this season.' });
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/cobblemon/register — withdraw from current season ─────────────
router.delete('/register', authMiddleware, async (req, res) => {
    try {
        const league = await getLeagueConfigData();
        const season = league?.season ?? 1;
        const regStatus = league?.registration?.status;
        if (regStatus === 'closed') return res.status(400).json({ error: 'Cannot withdraw after registrations are closed.' });

        await CobblemonRegistration.findOneAndUpdate(
            { discordId: req.player.discordId, season },
            { status: 'withdrawn' }
        );

        const newCount = await updateRegistrationCount(season);

        await syncPlayersToLpApi(season);
        res.json({ success: true, currentParticipants: newCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/cobblemon/register/status — check if current player is registered ─
router.get('/register/status', authMiddleware, async (req, res) => {
    try {
        const league = await getLeagueConfigData();
        const season = league?.season ?? 1;

        const reg = await CobblemonRegistration.findOne({
            discordId: req.player.discordId, season
        }).lean();

        res.json({
            registered: !!reg && reg.status !== 'withdrawn',
            status:     reg?.status ?? null,
            season,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/cobblemon/players — public list of registered players ─────────────
router.get('/players', async (req, res) => {
    try {
        const league = await getLeagueConfigData();
        const season = parseInt(req.query.season) || league?.season || 1;

        const regs = await CobblemonRegistration.find({
            season, status: { $ne: 'withdrawn' }
        }).sort({ registeredAt: 1 }).lean();

        const players = regs.map(r => ({
            discordUsername:   r.discordUsername,
            discordAvatar:     r.discordAvatar,
            minecraftUsername: r.minecraftUsername,
            minecraftUUID:     r.minecraftUUID,
            status:            r.status,
            registeredAt:      r.registeredAt,
            // Skin face URL via Crafatar (public CDN, no API key needed)
            skinFaceUrl: r.minecraftUUID
                ? `https://crafatar.com/avatars/${r.minecraftUUID}?size=64&overlay=true`
                : null,
        }));

        res.json({ season, players });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/cobblemon/registrations — HUB admin: full list with status ────────
router.get('/registrations', require('../middleware/auth').authMiddleware,
    require('../middleware/auth').requireRole('social', 'owner'),
    async (req, res) => {
        try {
            const league = await getLeagueConfigData();
            const season = parseInt(req.query.season) || league?.season || 1;
            const regs = await CobblemonRegistration.find({ season })
                .sort({ registeredAt: 1 }).lean();
            res.json({ season, registrations: regs });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// ── PATCH /api/cobblemon/registrations/:discordId — HUB: change status ─────────
router.patch('/registrations/:discordId', require('../middleware/auth').authMiddleware,
    require('../middleware/auth').requireRole('social', 'owner'),
    async (req, res) => {
        const { status } = req.body;
        const allowed = ['registered', 'confirmed', 'disqualified', 'withdrawn'];
        if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

        try {
            const league = await getLeagueConfigData();
            const season = league?.season ?? 1;

            const reg = await CobblemonRegistration.findOneAndUpdate(
                { discordId: req.params.discordId, season },
                { status },
                { new: true }
            );
            if (!reg) return res.status(404).json({ error: 'Registration not found.' });

            const newCount = await updateRegistrationCount(season);

            await syncPlayersToLpApi(season);
            res.json({ registration: reg, currentParticipants: newCount });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
