const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Team       = require('../models/Team');
const Goal       = require('../models/Goal');
const henrik     = require('../services/henrik');
const matchSync  = require('../services/matchSync');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getApiKey(teamId) {
    const team = await Team.findById(teamId).select('henrikApiKey').lean();
    return team?.henrikApiKey || null;
}

async function getUserRiot(userId) {
    const u = await User.findById(userId)
        .select('riotGameName riotTagLine riotRegion riotGameName2 riotTagLine2 riotRegion2')
        .lean();
    if (!u?.riotGameName || !u?.riotTagLine || !u?.riotRegion) return null;
    const primary = { gameName: u.riotGameName, tagLine: u.riotTagLine, region: u.riotRegion };
    if (u.riotGameName2 && u.riotTagLine2 && u.riotRegion2) {
        primary.secondary = { gameName: u.riotGameName2, tagLine: u.riotTagLine2, region: u.riotRegion2 };
    }
    return primary;
}

// Merge ranked stats from two accounts: tags each match with _account (1 or 2),
// then re-averages ACS/KD/HS/WR across the combined list.
function _mergeRankedStats(s1, s2) {
    const m1 = s1.matches.map(m => ({ ...m, _account: 1 }));
    const m2 = s2.matches.map(m => ({ ...m, _account: 2 }));
    const matches = [...m1, ...m2].sort((a, b) => b.date - a.date);
    const n = matches.length || 1;
    return {
        count:     matches.length,
        acs:       Math.round(matches.reduce((s, m) => s + m.acs, 0) / n),
        kd:        parseFloat((matches.reduce((s, m) => s + m.kd, 0) / n).toFixed(2)),
        hsPercent: Math.round(matches.reduce((s, m) => s + m.hsPercent, 0) / n),
        winRate:   Math.round(matches.filter(m => m.won).length / n * 100),
        matches,
    };
}

// Merge training stats from two accounts: sums day-by-day for totals,
// and also returns days1/days2 separately so the UI can colour-code per account.
function _mergeTrainingStats(t1, t2) {
    const dayMap = {};
    [...t1.days, ...t2.days].forEach(d => {
        if (!dayMap[d.date]) dayMap[d.date] = { date: d.date, dm: 0, tdm: 0, kills: 0 };
        dayMap[d.date].dm    += d.dm;
        dayMap[d.date].tdm   += d.tdm;
        dayMap[d.date].kills += d.kills;
    });
    const days = t1.days.map(d => dayMap[d.date] || { date: d.date, dm: 0, tdm: 0, kills: 0 });
    const allGames = Object.values(dayMap);
    const totalGames = allGames.reduce((s, d) => s + d.dm + d.tdm, 0);
    const totalKills = allGames.reduce((s, d) => s + d.kills, 0);
    return {
        days,
        days1: t1.days, // per-account breakdown for chart colour-coding
        days2: t2.days,
        totals: {
            dm:  allGames.reduce((s, d) => s + d.dm,  0),
            tdm: allGames.reduce((s, d) => s + d.tdm, 0),
        },
        avgKills: totalGames > 0 ? Math.round(totalKills / totalGames) : 0,
    };
}

// ── GET /api/henrik/player/today ─────────────────────────────────────────────
// Returns today's ranked + DM count from DB snapshot.
router.get('/player/today', async (req, res) => {
    try {
        let targetId = req.user.userId;

        if (req.query.userId && ['manager', 'captain'].includes(req.user.role)) {
            const target = await User.findOne({ _id: req.query.userId, teamId: req.user.teamId })
                .select('_id').lean();
            if (!target) return res.status(403).json({ error: 'Player not found in your team.' });
            targetId = req.query.userId;
        }

        const riot = await getUserRiot(targetId);
        if (!riot) return res.json({ hasRiotId: false, ranked: 0, dm: 0 });

        const counts = await matchSync.getTodayFromDB(req.user.teamId, targetId);
        res.json({ hasRiotId: true, ...counts });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── GET /api/henrik/team/today ───────────────────────────────────────────────
// Returns today's counts for all active team players from DB snapshot.
router.get('/team/today', requireRole('manager', 'captain'), async (req, res) => {
    try {
        const players = await User.find({ teamId: req.user.teamId, isActive: true })
            .select('_id username riotGameName riotTagLine riotRegion')
            .lean();

        const results = await Promise.all(players.map(async (p) => {
            if (!p.riotGameName) return { userId: p._id, username: p.username, hasRiotId: false, ranked: 0, dm: 0 };
            const counts = await matchSync.getTodayFromDB(req.user.teamId, p._id);
            return { userId: p._id, username: p.username, hasRiotId: true, ...counts };
        }));

        res.json({ players: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Resolve target user for manager/captain queries ──────────────────────────
// If ?userId= is provided AND requester is manager/captain, use that player's
// Riot ID (after verifying they belong to the same team). Otherwise use self.
async function resolveTargetRiot(req) {
    const { userId: selfId, teamId, role } = req.user;
    const targetId = req.query.userId;

    if (targetId && ['manager', 'captain'].includes(role)) {
        // Verify the target player belongs to the same team
        const target = await User.findOne({
            _id: targetId,
            $or: [{ teamId }, { teamIds: teamId }],
        }).select('riotGameName riotTagLine riotRegion riotGameName2 riotTagLine2 riotRegion2 username').lean();
        if (!target) return { riot: null, username: null, notFound: true };
        if (!target.riotGameName || !target.riotTagLine || !target.riotRegion)
            return { riot: null, username: target.username, noRiotId: true };
        const riot = { gameName: target.riotGameName, tagLine: target.riotTagLine, region: target.riotRegion };
        if (target.riotGameName2 && target.riotTagLine2 && target.riotRegion2) {
            riot.secondary = { gameName: target.riotGameName2, tagLine: target.riotTagLine2, region: target.riotRegion2 };
        }
        return { riot, username: target.username };
    }

    const riot = await getUserRiot(selfId);
    return { riot, username: null };
}

// ── GET /api/henrik/player/ranked ────────────────────────────────────────────
router.get('/player/ranked', async (req, res) => {
    try {
        const { riot, username, noRiotId, notFound } = await resolveTargetRiot(req);
        if (notFound)  return res.status(404).json({ error: 'Player not found in your team.' });
        if (!riot || noRiotId) return res.status(400).json({ error: 'Riot ID not configured.', noRiotId: true, username });

        const targetId = req.query.userId || req.user.userId;
        const stats    = await matchSync.getRankedFromDB(req.user.teamId, targetId);
        res.json({ riot, username, ...stats });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── GET /api/henrik/player/training ─────────────────────────────────────────
router.get('/player/training', async (req, res) => {
    try {
        const { riot, username, noRiotId, notFound } = await resolveTargetRiot(req);
        if (notFound)  return res.status(404).json({ error: 'Player not found in your team.' });
        if (!riot || noRiotId) return res.status(400).json({ error: 'Riot ID not configured.', noRiotId: true, username });

        const targetId = req.query.userId || req.user.userId;
        const stats    = await matchSync.getTrainingFromDB(req.user.teamId, targetId);
        res.json({ riot, username, ...stats });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── GET /api/henrik/sync/status ──────────────────────────────────────────────
router.get('/sync/status', requireRole('manager', 'captain'), (req, res) => {
    res.json(matchSync.getQueueStatus());
});

// ── POST /api/henrik/sync/skip ────────────────────────────────────────────────
// Skips the current inter-item wait (moves to the next player immediately).
router.post('/sync/skip', requireRole('manager', 'captain'), (req, res) => {
    const skipped = matchSync.skipWait();
    res.json({ skipped, message: skipped ? 'Wait skipped.' : 'No active wait to skip.' });
});

// ── POST /api/henrik/sync/run ─────────────────────────────────────────────────
// Manually triggers a full sync cycle (useful after deploy).
router.post('/sync/run', requireRole('manager', 'captain'), (req, res) => {
    matchSync.runSync();
    res.json({ message: 'Sync triggered.' });
});

// ── GET /api/henrik/ping ──────────────────────────────────────────────────────
// Diagnostic: tests 3 Henrik endpoints in sequence (status → account → match history)
// Query: ?region=na&name=PlayerName&tag=NA1
router.get('/ping', requireRole('manager', 'captain'), async (req, res) => {
    const { region, name, tag } = req.query;
    if (!region || !name || !tag)
        return res.status(400).json({ error: 'region, name and tag are required.' });
    try {
        const apiKey = await getApiKey(req.user.teamId);
        const result = await henrik.pingHenrik(apiKey, region, name, tag);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PATCH /api/henrik/verify ─────────────────────────────────────────────────
// Lightweight check that the Riot ID exists (uses getTodayProgress with size=1)
router.patch('/verify', async (req, res) => {
    try {
        const { gameName, tagLine, region } = req.body;
        if (!gameName || !tagLine || !region)
            return res.status(400).json({ error: 'gameName, tagLine and region are required.' });

        const apiKey = await getApiKey(req.user.teamId);
        // If getTodayProgress doesn't throw, account exists
        await henrik.getTodayProgress(region, gameName, tagLine, apiKey);

        res.json({ ok: true, gameName, tagLine, region });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
