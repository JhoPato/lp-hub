const express  = require('express');
const router   = express.Router();
const Strategy = require('../models/Strategy');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const list = await Strategy.find({ teamId: req.user.teamId })
            .sort({ updatedAt: -1 }).select('-objects').lean();
        res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const s = await Strategy.findOne({ _id: req.params.id, teamId: req.user.teamId }).lean();
        if (!s) return res.status(404).json({ error: 'Not found' });
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const { name, map, side, objects } = req.body;
        const s = await Strategy.create({ teamId: req.user.teamId, createdBy: req.user.userId, name, map, side, objects });
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, map, side, objects } = req.body;
        const s = await Strategy.findOneAndUpdate(
            { _id: req.params.id, teamId: req.user.teamId },
            { name, map, side, objects },
            { new: true }
        );
        if (!s) return res.status(404).json({ error: 'Not found' });
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await Strategy.findOneAndDelete({ _id: req.params.id, teamId: req.user.teamId });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
