const express  = require('express');
const router   = express.Router();
const Goal     = require('../models/Goal');
const { authMiddleware, requireRole } = require('../middleware/auth');

// All goals routes require auth
router.use(authMiddleware);

// ── GET /api/goals ──────────────────────────────────────────────────────────
// Manager/captain: returns all goals for the team
// Player: returns their individual goal + the 'all' goal (so UI can show whichever applies)
router.get('/', async (req, res) => {
    try {
        const { teamId, userId, role } = req.user;
        let goals;
        if (['manager', 'captain'].includes(role)) {
            goals = await Goal.find({ teamId }).sort({ createdAt: 1 }).lean();
        } else {
            // player sees only their own goal or the 'all' fallback
            goals = await Goal.find({
                teamId,
                $or: [{ playerId: String(userId) }, { playerId: 'all' }],
            }).lean();
        }
        res.json({ goals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/goals ─────────────────────────────────────────────────────────
// Manager/captain creates a new goal
router.post('/', requireRole('manager', 'captain'), async (req, res) => {
    try {
        const { teamId, userId } = req.user;
        const { playerId, minRanked, minDM, warmupMinutes } = req.body;

        if (!playerId) return res.status(400).json({ error: 'playerId is required.' });

        // Upsert: if a goal already exists for this (team, player), replace it
        const goal = await Goal.findOneAndUpdate(
            { teamId, playerId: String(playerId) },
            {
                $set: {
                    createdBy:     userId,
                    minRanked:     clamp(Number(minRanked)     ?? 2,  0, 20),
                    minDM:         clamp(Number(minDM)         ?? 3,  0, 20),
                    warmupMinutes: clamp(Number(warmupMinutes) ?? 30, 0, 120),
                    // Reset player adjustments when manager sets a new goal
                    playerRankedAdjust: 0,
                    playerDMAdjust:     0,
                },
            },
            { new: true, upsert: true }
        );
        res.status(201).json({ goal });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: 'Goal already exists for this player.' });
        res.status(500).json({ error: err.message });
    }
});

// ── PUT /api/goals/:id ──────────────────────────────────────────────────────
// Manager/captain updates a goal's base values
router.put('/:id', requireRole('manager', 'captain'), async (req, res) => {
    try {
        const { teamId } = req.user;
        const { playerId, minRanked, minDM, warmupMinutes } = req.body;

        const update = {};
        if (playerId     !== undefined) update.playerId      = String(playerId);
        if (minRanked    !== undefined) update.minRanked     = clamp(Number(minRanked),     0, 20);
        if (minDM        !== undefined) update.minDM         = clamp(Number(minDM),         0, 20);
        if (warmupMinutes!== undefined) update.warmupMinutes = clamp(Number(warmupMinutes), 0, 120);

        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, teamId },
            { $set: update },
            { new: true }
        );
        if (!goal) return res.status(404).json({ error: 'Goal not found.' });
        res.json({ goal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/goals/:id ───────────────────────────────────────────────────
router.delete('/:id', requireRole('manager', 'captain'), async (req, res) => {
    try {
        const { teamId } = req.user;
        const goal = await Goal.findOneAndDelete({ _id: req.params.id, teamId });
        if (!goal) return res.status(404).json({ error: 'Goal not found.' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PATCH /api/goals/:id/adjust ─────────────────────────────────────────────
// Any player can adjust their own Ranked/DM goal within ±5.
// Captain/manager can also adjust any goal (no restriction).
router.patch('/:id/adjust', async (req, res) => {
    try {
        const { teamId, userId, role } = req.user;
        const { field, adjust } = req.body; // field: 'ranked' | 'dm', adjust: number −5..5

        if (!['ranked', 'dm'].includes(field)) {
            return res.status(400).json({ error: 'field must be "ranked" or "dm".' });
        }
        const adj = clamp(Number(adjust), -5, 5);
        if (isNaN(adj)) return res.status(400).json({ error: 'adjust must be a number.' });

        const goal = await Goal.findOne({ _id: req.params.id, teamId });
        if (!goal) return res.status(404).json({ error: 'Goal not found.' });

        // Players can only adjust their own goal (playerId matches userId) or the 'all' goal
        if (!['manager', 'captain'].includes(role)) {
            const isOwn = goal.playerId === String(userId) || goal.playerId === 'all';
            if (!isOwn) return res.status(403).json({ error: 'Cannot adjust another player\'s goal.' });
        }

        const key = field === 'ranked' ? 'playerRankedAdjust' : 'playerDMAdjust';
        await Goal.updateOne(
            { _id: goal._id },
            { $set: { [key]: adj } }
        );
        goal[key] = adj;
        res.json({ goal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Helper ──────────────────────────────────────────────────────────────────
function clamp(n, min, max) {
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
}

module.exports = router;
