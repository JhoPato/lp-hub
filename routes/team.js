const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const User    = require('../models/User');
const Team    = require('../models/Team');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { uploadTeamLogo, deleteImage } = require('../config/cloudinary');

const LP_API_URL = process.env.LP_API_URL || 'http://localhost:8080';

router.patch('/logo', authMiddleware, requireRole('manager'), uploadTeamLogo.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided.' });
        const team = await Team.findById(req.user.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        if (team.cloudinaryPublicId) await deleteImage(team.cloudinaryPublicId);
        team.logoUrl            = req.file.path;
        team.cloudinaryPublicId = req.file.filename;
        await team.save();
        res.json(team);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/all', authMiddleware, async (req, res) => {
    try {
        const teams = await Team.find({}).select('name tag region logoUrl logos').sort({ name: 1 });
        res.json(teams);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        const t = team.toObject();
        t.hasHenrikKey = !!t.henrikApiKey;
        delete t.henrikApiKey;
        res.json(t);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { name, tag, region } = req.body;
        const team = await Team.findByIdAndUpdate(
            req.user.teamId,
            { $set: { name, tag, region } },
            { new: true }
        );
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        res.json(team);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// PATCH /api/team/henrik-key — save/clear Henrik API key
router.patch('/henrik-key', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { henrikApiKey } = req.body;
        const team = await Team.findByIdAndUpdate(
            req.user.teamId,
            { $set: { henrikApiKey: henrikApiKey?.trim() || null } },
            { new: true, select: 'henrikApiKey' }
        );
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        res.json({ ok: true, hasKey: !!team.henrikApiKey });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/players', authMiddleware, async (req, res) => {
    try {
        const players = await User.find({ teamId: req.user.teamId })
            .select('-passwordHash')
            .sort({ role: 1, username: 1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/players/:userId/role', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { role } = req.body;
        if (!['player','captain','manager'].includes(role))
            return res.status(400).json({ error: 'Invalid role.' });

        const player = await User.findOneAndUpdate(
            { _id: req.params.userId, teamId: req.user.teamId },
            { $set: { role } },
            { new: true, select: '-passwordHash' }
        );
        if (!player) return res.status(404).json({ error: 'Player not found.' });
        res.json(player);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/players/:userId/deactivate', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { isActive } = req.body;
        const player = await User.findOneAndUpdate(
            { _id: req.params.userId, teamId: req.user.teamId },
            { $set: { isActive: Boolean(isActive) } },
            { new: true, select: '-passwordHash' }
        );
        if (!player) return res.status(404).json({ error: 'Player not found.' });
        res.json(player);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/players/:userId/panel-sync', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { apiPanelPlayerName } = req.body;
        const player = await User.findOneAndUpdate(
            { _id: req.params.userId, teamId: req.user.teamId },
            { $set: { apiPanelPlayerName: apiPanelPlayerName || null } },
            { new: true, select: '-passwordHash' }
        );
        if (!player) return res.status(404).json({ error: 'Player not found.' });
        res.json(player);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/panel/roster', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (team?.lpApiTeam?.region == null || team.lpApiTeam.teamIndex == null)
            return res.status(400).json({ error: 'No LP-API team linked.' });
        const r = await axios.get(`${LP_API_URL}/api/rosters`);
        const t = r.data[team.lpApiTeam.region]?.[team.lpApiTeam.teamIndex];
        if (!t) return res.status(404).json({ error: 'Linked team not found in LP-API.' });
        res.json({ teamName: t.name, players: t.players || [], coaches: t.coaches || [], panelCode: t.panelCode });
    } catch (err) {
        res.status(502).json({ error: 'Could not reach LP-API.' });
    }
});

router.put('/panel/roster', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (team?.lpApiTeam?.region == null || team.lpApiTeam.teamIndex == null)
            return res.status(400).json({ error: 'No LP-API team linked.' });
        const r = await axios.get(`${LP_API_URL}/api/rosters`);
        const panelCode = r.data[team.lpApiTeam.region]?.[team.lpApiTeam.teamIndex]?.panelCode;
        if (!panelCode) return res.status(404).json({ error: 'Linked team not found in LP-API.' });
        const { players, coaches } = req.body;
        await axios.put(`${LP_API_URL}/api/panel/${panelCode}/roster`, { players, coaches });
        res.json({ success: true });
    } catch (err) { res.status(502).json({ error: 'Could not reach LP-API.' }); }
});

router.post('/panel/sync-photos', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (team?.lpApiTeam?.region == null || team.lpApiTeam.teamIndex == null)
            return res.status(400).json({ error: 'No LP-API team linked.' });
        const r = await axios.get(`${LP_API_URL}/api/rosters`);
        const panelCode = r.data[team.lpApiTeam.region]?.[team.lpApiTeam.teamIndex]?.panelCode;
        if (!panelCode) return res.status(404).json({ error: 'Linked team not found in LP-API.' });

        const players = await User.find({
            teamId: req.user.teamId, isActive: true,
            profilePhotoUrl: { $exists: true, $ne: '' },
            apiPanelPlayerName: { $exists: true, $ne: null },
        }).select('username profilePhotoUrl apiPanelPlayerName');

        let synced = 0, skipped = 0;
        for (const p of players) {
            if (!p.profilePhotoUrl || !p.apiPanelPlayerName) { skipped++; continue; }
            try {
                await axios.patch(`${LP_API_URL}/api/panel/${panelCode}/player-photo`, {
                    playerName: p.apiPanelPlayerName,
                    photoUrl:   p.profilePhotoUrl,
                });
                synced++;
            } catch { skipped++; }
        }
        res.json({ synced, skipped, message: `${synced} photo(s) synced, ${skipped} skipped.` });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/panel/sync-logo', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (team?.lpApiTeam?.region == null || team.lpApiTeam.teamIndex == null)
            return res.status(400).json({ error: 'No LP-API team linked.' });
        if (!team.logoUrl) return res.status(400).json({ error: 'Team has no logo uploaded.' });
        const r = await axios.get(`${LP_API_URL}/api/rosters`);
        const panelCode = r.data[team.lpApiTeam.region]?.[team.lpApiTeam.teamIndex]?.panelCode;
        if (!panelCode) return res.status(404).json({ error: 'Linked team not found in LP-API.' });
        await axios.patch(`${LP_API_URL}/api/panel/${panelCode}/team-logo`, { logoUrl: team.logoUrl });
        res.json({ message: 'Team logo synced to LP-API.' });
    } catch (err) { res.status(502).json({ error: 'Could not reach LP-API.' }); }
});

module.exports = router;
