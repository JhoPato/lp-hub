const express    = require('express');
const router     = express.Router();
const InviteCode = require('../models/InviteCode');
const Team       = require('../models/Team');
const { authMiddleware, requireRole } = require('../middleware/auth');

const TEAM_ROLES    = ['player', 'captain', 'manager'];
const ALL_ROLES     = ['player', 'captain', 'manager', 'social', 'owner'];
const TEAMLESS_ROLES = ['social', 'owner']; 


router.get('/preview/:code', async (req, res) => {
    try {
        const invite = await InviteCode.findOne({ code: req.params.code.toUpperCase(), isUsed: false });
        if (!invite) return res.status(404).json({ error: 'Invalid or already used invite code.' });
        if (new Date() > invite.expiresAt) return res.status(400).json({ error: 'Invite code has expired.' });
        res.json({ role: invite.role, valid: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});


router.post('/generate', authMiddleware, requireRole('manager', 'owner'), async (req, res) => {
    try {
        const { role = 'player', expiresInDays = 7, siteTeam, teamId } = req.body;

        if (!ALL_ROLES.includes(role))
            return res.status(400).json({ error: 'Invalid role.' });

        
        if (req.user.role === 'manager' && !['player', 'captain'].includes(role))
            return res.status(403).json({ error: 'Managers can only invite player/captain roles.' });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(expiresInDays));

        const isTeamless = TEAMLESS_ROLES.includes(role);
        let targetTeamId = null;

        if (!isTeamless) {
            if (req.user.role === 'owner') {
                if (!teamId) return res.status(400).json({ error: 'Select a team for player, captain, or manager invites.' });
                const team = await Team.findById(teamId).select('_id');
                if (!team) return res.status(404).json({ error: 'Selected team not found.' });
                targetTeamId = team._id;
            } else {
                targetTeamId = req.user.teamId;
            }
        }

        const invite = await InviteCode.create({
            code:      InviteCode.generate(),
            teamId:    targetTeamId,
            role,
            siteTeam:  (role === 'manager' && siteTeam) ? siteTeam : { region: null, teamIndex: null },
            createdBy: req.user.userId,
            expiresAt,
        });

        res.status(201).json(invite);
    } catch (err) {
        console.error('[invites/generate]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


router.get('/', authMiddleware, requireRole('manager', 'owner'), async (req, res) => {
    try {
        let query;
        if (req.user.role === 'owner') {
            
            query = {};
        } else {
            query = { teamId: req.user.teamId };
        }

        const invites = await InviteCode.find(query)
            .populate('teamId', 'name tag region')
            .populate('usedBy', 'username')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });
        res.json(invites);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});


router.delete('/:id', authMiddleware, requireRole('manager', 'owner'), async (req, res) => {
    try {
        const filter = req.user.role === 'owner'
            ? { _id: req.params.id }
            : { _id: req.params.id, teamId: req.user.teamId };

        const invite = await InviteCode.findOne(filter);
        if (!invite) return res.status(404).json({ error: 'Invite not found.' });
        if (invite.isUsed) return res.status(400).json({ error: 'Cannot revoke an already used invite.' });
        await invite.deleteOne();
        res.json({ success: true, message: 'Invite revoked.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
