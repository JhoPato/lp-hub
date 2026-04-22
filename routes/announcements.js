const express      = require('express');
const router       = require('express').Router();
const Announcement = require('../models/Announcement');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 30);
        const filter = { teamId: req.user.teamId };
        const [items, total] = await Promise.all([
            Announcement.find(filter)
                .populate('authorId', 'username role')
                .sort({ isPinned: -1, createdAt: -1 })
                .skip((page - 1) * limit).limit(limit),
            Announcement.countDocuments(filter),
        ]);
        res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { title, body, isPinned = false } = req.body;
        if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
        if (title.length > 150) return res.status(400).json({ error: 'Title too long (max 150 chars).' });
        if (body.length > 5000)  return res.status(400).json({ error: 'Body too long (max 5000 chars).' });
        const item = await Announcement.create({
            teamId: req.user.teamId, authorId: req.user.userId,
            title: title.trim(), body: body.trim(), isPinned
        });
        res.status(201).json(item);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { title, body } = req.body;
        if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
        const item = await Announcement.findOneAndUpdate(
            { _id: req.params.id, teamId: req.user.teamId },
            { $set: { title: title.trim(), body: body.trim() } },
            { new: true }
        );
        if (!item) return res.status(404).json({ error: 'Announcement not found.' });
        res.json(item);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/:id/pin', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const item = await Announcement.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!item) return res.status(404).json({ error: 'Announcement not found.' });
        item.isPinned = !item.isPinned;
        await item.save();
        res.json(item);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const item = await Announcement.findOneAndDelete({ _id: req.params.id, teamId: req.user.teamId });
        if (!item) return res.status(404).json({ error: 'Announcement not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
