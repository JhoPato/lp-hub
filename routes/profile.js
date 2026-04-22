const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadProfile, cloudinary } = require('../config/cloudinary');

router.patch('/me', authMiddleware, async (req, res) => {
    try {
        const { username, email } = req.body;
        if (!username || !email)
            return res.status(400).json({ error: 'Username and email are required.' });

        const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user.userId } });
        if (existing) return res.status(400).json({ error: 'Email already in use.' });

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: { username, email: email.toLowerCase() } },
            { new: true, select: '-passwordHash' }
        );
        res.json(user);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/photo', authMiddleware, uploadProfile.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided.' });

        const current = await User.findById(req.user.userId).select('cloudinaryPublicId');
        if (current?.cloudinaryPublicId) {
            await cloudinary.uploader.destroy(current.cloudinaryPublicId).catch(() => {});
        }

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: { profilePhotoUrl: req.file.path, cloudinaryPublicId: req.file.filename } },
            { new: true, select: '-passwordHash' }
        );
        res.json({ profilePhotoUrl: user.profilePhotoUrl });
    } catch (err) {
        console.error('[profile/photo]', err);
        res.status(500).json({ error: 'Upload failed.' });
    }
});

router.patch('/riot', authMiddleware, async (req, res) => {
    try {
        const body = req.body;
        const validRegions = ['na','eu','ap','kr','latam','br'];
        const update = {};

        // Account 1 — only update fields explicitly present in the request body
        if ('riotGameName' in body || 'riotTagLine' in body || 'riotRegion' in body) {
            const { riotGameName, riotTagLine, riotRegion } = body;
            if (riotGameName && !riotTagLine)
                return res.status(400).json({ error: 'Tag line is required when setting a Game Name.' });
            if (riotRegion && !validRegions.includes(riotRegion))
                return res.status(400).json({ error: 'Invalid region.' });
            if ('riotGameName' in body) update.riotGameName = riotGameName?.trim() || null;
            if ('riotTagLine'  in body) update.riotTagLine  = riotTagLine?.trim()  || null;
            if ('riotRegion'   in body) update.riotRegion   = riotRegion            || null;
        }

        // Account 2 — only update fields explicitly present in the request body
        if ('riotGameName2' in body || 'riotTagLine2' in body || 'riotRegion2' in body) {
            const { riotGameName2, riotTagLine2, riotRegion2 } = body;
            if (riotGameName2 && !riotTagLine2)
                return res.status(400).json({ error: 'Tag line is required for the second account.' });
            if (riotRegion2 && !validRegions.includes(riotRegion2))
                return res.status(400).json({ error: 'Invalid region for second account.' });
            if ('riotGameName2' in body) update.riotGameName2 = riotGameName2?.trim() || null;
            if ('riotTagLine2'  in body) update.riotTagLine2  = riotTagLine2?.trim()  || null;
            if ('riotRegion2'   in body) update.riotRegion2   = riotRegion2            || null;
        }

        if (!Object.keys(update).length)
            return res.status(400).json({ error: 'No fields to update.' });

        await User.updateOne({ _id: req.user.userId }, { $set: update });
        const user = await User.findById(req.user.userId).select('-passwordHash').lean();
        res.json({
            ok: true,
            riotGameName:  user.riotGameName,  riotTagLine:  user.riotTagLine,  riotRegion:  user.riotRegion,
            riotGameName2: user.riotGameName2, riotTagLine2: user.riotTagLine2, riotRegion2: user.riotRegion2,
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
