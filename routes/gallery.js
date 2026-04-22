const express = require('express');
const router  = express.Router();
const MediaGallery = require('../models/MediaGallery');
const Team         = require('../models/Team');
const User         = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadGallery, uploadTeamLogo, deleteImage } = require('../config/cloudinary');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const filter = { teamId: req.user.teamId, isAdminUpload: false };
        if (req.user.role === 'player') {
            filter.uploadedBy = req.user.userId;
        } else if (req.query.uploadedBy) {
            filter.uploadedBy = req.query.uploadedBy;
        }
        if (req.query.type) filter.type = req.query.type;
        const media = await MediaGallery.find(filter)
            .populate('uploadedBy', 'username profilePhotoUrl role')
            .sort({ createdAt: -1 })
            .limit(300);
        res.json(media);
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/team/:teamId', authMiddleware, async (req, res) => {
    if (!['owner', 'social'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden.' });
    try {
        const { teamId } = req.params;
        const team = await Team.findById(teamId).select('name tag region logoUrl logos');
        if (!team) return res.status(404).json({ error: 'Team not found.' });

        const users = await User.find({
            $or: [{ teamId }, { teamIds: teamId }],
            isActive: true,
        }).select('username profilePhotoUrl role');

        const players  = users.filter(u => ['player', 'captain'].includes(u.role));
        const managers = users.filter(u => u.role === 'manager');

        const allMedia = await MediaGallery.find({ teamId, isAdminUpload: false })
            .populate('uploadedBy', 'username profilePhotoUrl role')
            .sort({ createdAt: -1 });

        const adminMedia = await MediaGallery.find({ teamId, isAdminUpload: true })
            .populate('uploadedBy', 'username profilePhotoUrl role')
            .sort({ createdAt: -1 });

        const managementRoles = new Set(['manager', 'owner']);

        res.json({
            team,
            players,
            managers,
            playerGallery:        allMedia.filter(m => !managementRoles.has(m.uploadedBy?.role)),
            managerGallery:       allMedia.filter(m => managementRoles.has(m.uploadedBy?.role)),
            adminPlayerUploads:   adminMedia.filter(m => m.adminSection === 'players'),
            adminManagerUploads:  adminMedia.filter(m => m.adminSection === 'managers'),
        });
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/team/:teamId/logo/:category', authMiddleware, uploadTeamLogo.single('file'), async (req, res) => {
    const isManagerOwnTeam = req.user.role === 'manager' && req.user.teamId?.toString() === req.params.teamId;
    if (!['owner', 'social'].includes(req.user.role) && !isManagerOwnTeam) return res.status(403).json({ error: 'Forbidden.' });
    const valid = ['main', 'whiteBg', 'blackBg', 'coloredBg'];
    const cat = req.params.category;
    if (!valid.includes(cat)) return res.status(400).json({ error: 'Invalid category.' });
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        if (team.logos?.[cat]?.publicId) await deleteImage(team.logos[cat].publicId);
        if (!team.logos) team.logos = {};
        team.logos[cat] = { url: req.file.path, publicId: req.file.filename };
        if (cat === 'main') team.logoUrl = req.file.path;
        team.markModified('logos');
        await team.save();
        res.json({ url: req.file.path, publicId: req.file.filename });
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/team/:teamId/logo/:category', authMiddleware, async (req, res) => {
    const isManagerOwnTeam = req.user.role === 'manager' && req.user.teamId?.toString() === req.params.teamId;
    if (!['owner', 'social'].includes(req.user.role) && !isManagerOwnTeam) return res.status(403).json({ error: 'Forbidden.' });
    const valid = ['main', 'whiteBg', 'blackBg', 'coloredBg'];
    const cat = req.params.category;
    if (!valid.includes(cat)) return res.status(400).json({ error: 'Invalid category.' });
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        if (team.logos?.[cat]?.publicId) await deleteImage(team.logos[cat].publicId);
        if (!team.logos) team.logos = {};
        team.logos[cat] = { url: '', publicId: '' };
        if (cat === 'main') team.logoUrl = '';
        team.markModified('logos');
        await team.save();
        res.json({ message: 'Deleted.' });
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/team/:teamId/admin', authMiddleware, uploadGallery.single('file'), async (req, res) => {
    if (!['owner', 'social'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden.' });
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    const section = req.body.section;
    if (!['players', 'managers'].includes(section)) return res.status(400).json({ error: 'Invalid section.' });
    try {
        const item = await MediaGallery.create({
            teamId:             req.params.teamId,
            uploadedBy:         req.user.userId,
            type:               'photo',
            url:                req.file.path,
            cloudinaryPublicId: req.file.filename,
            caption:            (req.body.caption || '').slice(0, 200),
            isAdminUpload:      true,
            adminSection:       section,
        });
        const populated = await item.populate('uploadedBy', 'username profilePhotoUrl role');
        res.status(201).json(populated);
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/upload', authMiddleware, uploadGallery.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided.' });
        const caption = (req.body.caption || '').slice(0, 200);
        const item = await MediaGallery.create({
            teamId:             req.user.teamId,
            uploadedBy:         req.user.userId,
            type:               req.body.type === 'screenshot' ? 'screenshot' : 'photo',
            url:                req.file.path,
            cloudinaryPublicId: req.file.filename,
            caption,
        });
        const populated = await item.populate('uploadedBy', 'username profilePhotoUrl role');
        res.status(201).json(populated);
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/:id/caption', authMiddleware, async (req, res) => {
    try {
        const filter = { _id: req.params.id };
        if (!['owner', 'social'].includes(req.user.role)) {
            filter.teamId = req.user.teamId;
            if (req.user.role !== 'manager') filter.uploadedBy = req.user.userId;
        }
        const caption = (req.body.caption || '').slice(0, 200);
        const item = await MediaGallery.findOneAndUpdate(filter, { $set: { caption } }, { new: true })
            .populate('uploadedBy', 'username profilePhotoUrl role');
        if (!item) return res.status(404).json({ error: 'Not found or no permission.' });
        res.json(item);
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const filter = { _id: req.params.id };
        if (!['owner', 'social'].includes(req.user.role)) {
            filter.teamId = req.user.teamId;
            if (req.user.role !== 'manager') filter.uploadedBy = req.user.userId;
        }
        const item = await MediaGallery.findOneAndDelete(filter);
        if (!item) return res.status(404).json({ error: 'Not found or no permission.' });
        await deleteImage(item.cloudinaryPublicId);
        res.json({ message: 'Deleted.' });
    } catch { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
