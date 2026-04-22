const express = require('express');
const router  = express.Router();
const Task    = require('../models/Task');
const User    = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { uploadTaskFile, deleteImage }  = require('../config/cloudinary');

const YT_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|live\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/;

router.get('/', authMiddleware, async (req, res) => {
    try {
        const filter = { teamId: req.user.teamId };
        if (req.query.status)   filter.status   = req.query.status;
        if (req.query.category) filter.category = req.query.category;

        if (req.query.mine === 'true') {
            filter.assignedTo = req.user.userId;
        } else if (req.query.mine === 'false') {
            filter.assignedTo = { $size: 0 };
        } else if (req.user.role === 'player') {
            filter.$or = [{ assignedTo: { $size: 0 } }, { assignedTo: req.user.userId }];
        }

        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);

        const [tasks, total] = await Promise.all([
            Task.find(filter).lean()
                .populate('assignedTo',   'username')
                .populate('createdBy',    'username')
                .populate('linkedPraccId','opponent date vodUrl result mapName')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit).limit(limit),
            Task.countDocuments(filter),
        ]);
        res.json({ tasks, total, page, pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { title, description, assignedTo, category, priority, dueDate,
                requiresUpload, vodType, linkedPraccId, externalVodUrl } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required.' });
        if (title.length > 120) return res.status(400).json({ error: 'Title too long (max 120 chars).' });

        const safeVodType = ['none','pracc','external'].includes(vodType) ? vodType : 'none';
        if (safeVodType === 'external' && externalVodUrl && !YT_REGEX.test(externalVodUrl))
            return res.status(400).json({ error: 'Invalid YouTube URL.' });

        const task = await Task.create({
            teamId:         req.user.teamId,
            createdBy:      req.user.userId,
            title:          title.trim(),
            description:    (description || '').slice(0, 1000),
            assignedTo:     Array.isArray(assignedTo) ? assignedTo.filter(Boolean) : (assignedTo ? [assignedTo] : []),
            category:       ['general','analysis','preparation','physical','vod_review'].includes(category) ? category : 'general',
            priority:       ['low','medium','high'].includes(priority) ? priority : 'medium',
            dueDate:        dueDate || null,
            requiresUpload: requiresUpload === true || requiresUpload === 'true',
            vodType:        safeVodType,
            linkedPraccId:  safeVodType === 'pracc' ? (linkedPraccId || null) : null,
            externalVodUrl: safeVodType === 'external' ? (externalVodUrl || null) : null,
        });
        res.status(201).json(task);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const { title, description, assignedTo, category, priority, status, dueDate,
                requiresUpload, vodType, linkedPraccId, externalVodUrl } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required.' });
        if (title.length > 120) return res.status(400).json({ error: 'Title too long (max 120 chars).' });

        const safeVodType = ['none','pracc','external'].includes(vodType) ? vodType : 'none';
        if (safeVodType === 'external' && externalVodUrl && !YT_REGEX.test(externalVodUrl))
            return res.status(400).json({ error: 'Invalid YouTube URL.' });

        task.title          = title.trim();
        task.description    = (description || '').slice(0, 1000);
        task.assignedTo     = Array.isArray(assignedTo) ? assignedTo.filter(Boolean) : (assignedTo ? [assignedTo] : []);
        task.category       = ['general','analysis','preparation','physical','vod_review'].includes(category) ? category : 'general';
        task.priority       = ['low','medium','high'].includes(priority) ? priority : 'medium';
        task.dueDate        = dueDate || null;
        task.requiresUpload = requiresUpload === true || requiresUpload === 'true';
        task.vodType        = safeVodType;
        task.linkedPraccId  = safeVodType === 'pracc' ? (linkedPraccId || null) : null;
        task.externalVodUrl = safeVodType === 'external' ? (externalVodUrl || null) : null;
        if (status && ['pending','in_progress','completed'].includes(status)) task.status = status;
        await task.save();
        res.json(task);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending','in_progress','completed'].includes(status))
            return res.status(400).json({ error: 'Invalid status.' });

        const filter = { _id: req.params.id, teamId: req.user.teamId };
        if (req.user.role === 'player') {
            filter.$or = [{ assignedTo: { $size: 0 } }, { assignedTo: req.user.userId }];
        }

        const update = { status };
        if (status === 'completed') { update.completedAt = new Date(); update.completedBy = req.user.userId; }
        else { update.completedAt = null; update.completedBy = null; }

        const task = await Task.findOneAndUpdate(filter, { $set: update }, { new: true });
        if (!task) return res.status(404).json({ error: 'Task not found or no permission.' });
        res.json(task);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/comments', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: 'Comment text is required.' });

        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        if (req.user.role === 'player') {
            const hasAccess = task.assignedTo.length === 0 ||
                task.assignedTo.some(id => id.equals(req.user.userId));
            if (!hasAccess) return res.status(403).json({ error: 'No access to this task.' });
        }

        const author = await User.findById(req.user.userId).select('username').lean();
        task.comments.push({
            authorId:   req.user.userId,
            authorName: author?.username || 'Unknown',
            text:       text.trim().slice(0, 500),
        });
        await task.save();
        res.status(201).json(task.comments[task.comments.length - 1]);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const comment = task.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found.' });

        const isAuthor  = comment.authorId.equals(req.user.userId);
        const isManager = req.user.role === 'manager';
        if (!isAuthor && !isManager) return res.status(403).json({ error: 'Cannot delete this comment.' });

        comment.deleteOne();
        await task.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/timestamps', authMiddleware, async (req, res) => {
    try {
        const { seconds, label, note } = req.body;
        if (typeof seconds !== 'number' || seconds < 0)
            return res.status(400).json({ error: 'seconds must be a non-negative number.' });

        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        if (task.vodType !== 'external') return res.status(400).json({ error: 'Task has no external VOD.' });

        const author = await User.findById(req.user.userId).select('username').lean();
        task.vodTimestamps.push({
            seconds,
            label:      (label || '').trim().slice(0, 200),
            note:       (note  || '').trim().slice(0, 500),
            authorId:   req.user.userId,
            authorName: author?.username || 'Unknown',
        });
        task.vodTimestamps.sort((a, b) => a.seconds - b.seconds);
        await task.save();
        res.status(201).json(task.vodTimestamps[task.vodTimestamps.length - 1]);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id/timestamps/:tsId', authMiddleware, async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const ts = task.vodTimestamps.id(req.params.tsId);
        if (!ts) return res.status(404).json({ error: 'Timestamp not found.' });

        const isAuthor  = ts.authorId.equals(req.user.userId);
        const isManager = req.user.role === 'manager';
        if (!isAuthor && !isManager) return res.status(403).json({ error: 'Cannot delete this timestamp.' });

        ts.deleteOne();
        await task.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/upload', authMiddleware, uploadTaskFile.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided.' });
        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        if (!task.requiresUpload) return res.status(400).json({ error: 'This task does not accept uploads.' });
        task.uploadedFiles.push({
            url:        req.file.path,
            publicId:   req.file.filename,
            caption:    (req.body.caption || '').slice(0, 200),
            uploadedBy: req.user.userId,
        });
        await task.save();
        res.json(task);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id/upload/:fileId', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        const file = task.uploadedFiles.id(req.params.fileId);
        if (file) { await deleteImage(file.publicId); file.deleteOne(); }
        await task.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, teamId: req.user.teamId });
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
