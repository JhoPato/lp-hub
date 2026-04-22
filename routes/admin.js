const express    = require('express');
const router     = express.Router();
const jwt        = require('jsonwebtoken');
const User       = require('../models/User');
const Team       = require('../models/Team');
const InviteCode   = require('../models/InviteCode');
const MediaGallery = require('../models/MediaGallery');
const PraccMatch    = require('../models/PraccMatch');
const Task          = require('../models/Task');
const Announcement  = require('../models/Announcement');
const { cloudinary } = require('../config/cloudinary');
const mongoose     = require('mongoose');
const { authMiddleware, requireOwner } = require('../middleware/auth');

router.post('/bootstrap', async (req, res) => {
    try {
        const { secret } = req.body;
        if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET)
            return res.status(403).json({ error: 'Invalid secret.' });

        const TEAMS = [
            { name: 'LP Tau',             tag: 'TAU', region: 'BR' },
            { name: 'LP Youngsters',       tag: 'YNG', region: 'BR' },
            { name: 'Lost Puppies',        tag: 'LP',  region: 'UK' },
            { name: 'Lost Puppies Wales',  tag: 'WAL', region: 'UK' },
            { name: 'LP FR',               tag: 'FR',  region: 'FR' },
            { name: 'LP ITA',              tag: 'ITA', region: 'IT' },
            { name: 'LP Peuchén',          tag: 'PCH', region: 'CL' },
            { name: 'LP ES',               tag: 'ES',  region: 'ES' },
            { name: 'LP DE',               tag: 'DE',  region: 'DE' },
            { name: 'LP TR',               tag: 'TR',  region: 'TR' },
            { name: 'LP US',               tag: 'US',  region: 'US' },
            { name: 'Bitfix Puppies GC',   tag: 'GC',  region: 'EU' },
        ];

        const createdTeams = [];
        for (const t of TEAMS) {
            const exists = await Team.findOne({ name: t.name });
            if (!exists) {
                await Team.create({ ...t, game: 'Valorant' });
                createdTeams.push(t.name);
            }
        }

        const OWNERS = [
            { username: 'porridge', email: 'owner@lostpuppies.hub',   password: process.env.BOOTSTRAP_OWNER1_PASS },
            { username: 'JhoPato',  email: 'helielsonjho@gmail.com',  password: process.env.BOOTSTRAP_OWNER2_PASS },
        ].filter(o => o.password);

        const ownersCreated = [];
        for (const o of OWNERS) {
            const exists = await User.findOne({ username: o.username });
            if (!exists) {
                await User.create({
                    username:     o.username,
                    email:        o.email,
                    passwordHash: User.hashPassword(o.password),
                    role:         'owner',
                    teamId:       null,
                    isActive:     true,
                });
                ownersCreated.push(o.username);
            }
        }

        res.json({
            message:       'Bootstrap complete.',
            teamsCreated:  createdTeams,
            ownersCreated,
        });
    } catch (err) {
        console.error('[admin/bootstrap]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.use(authMiddleware, requireOwner);

router.get('/teams', async (req, res) => {
    try {
        const teams = await Team.find().sort({ name: 1 });
        const result = await Promise.all(teams.map(async t => {
            const memberQuery = { $or: [{ teamIds: t._id }, { teamId: t._id }], isActive: true };
            const playerCount = await User.countDocuments(memberQuery);
            const manager = await User.findOne({ ...memberQuery, role: 'manager' }).select('username');
            return { ...t.toObject(), playerCount, managerName: manager?.username || null };
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/teams', async (req, res) => {
    try {
        const { name, tag, region, game } = req.body;
        if (!name || !tag || !region)
            return res.status(400).json({ error: 'name, tag, region are required.' });
        const team = await Team.create({ name, tag, region, game: game || 'Valorant' });
        res.status(201).json(team);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/teams/:id', async (req, res) => {
    try {
        const { name, tag, region, game } = req.body;
        const team = await Team.findByIdAndUpdate(
            req.params.id,
            { $set: { name, tag, region, game } },
            { new: true }
        );
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        res.json(team);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/teams/:id/features', async (req, res) => {
    try {
        const { multiRegionEnabled } = req.body;
        const team = await Team.findByIdAndUpdate(
            req.params.id,
            { $set: { multiRegionEnabled: !!multiRegionEnabled } },
            { new: true, select: 'multiRegionEnabled name' }
        );
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        res.json({ ok: true, multiRegionEnabled: team.multiRegionEnabled });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/teams/:id', async (req, res) => {
    try {
        await Team.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/teams/:id/players', async (req, res) => {
    try {
        const players = await User.find({ $or: [{ teamIds: req.params.id }, { teamId: req.params.id }] })
            .select('-passwordHash')
            .sort({ role: 1, username: 1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/teams/:id/players/:userId/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['player', 'captain', 'manager'].includes(role))
            return res.status(400).json({ error: 'Invalid role.' });
        const player = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: { role } },
            { new: true, select: '-passwordHash' }
        );
        if (!player) return res.status(404).json({ error: 'User not found.' });
        res.json(player);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/teams/:id/players/:userId/active', async (req, res) => {
    try {
        const { isActive } = req.body;
        const player = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: { isActive: Boolean(isActive) } },
            { new: true, select: '-passwordHash' }
        );
        if (!player) return res.status(404).json({ error: 'User not found.' });
        res.json(player);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/users/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        if (user.role === 'owner') return res.status(403).json({ error: 'Cannot delete owner accounts.' });
        await User.findByIdAndDelete(req.params.userId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/teams/:id/invite', async (req, res) => {
    try {
        const { role = 'manager', expiresInDays = 30 } = req.body;
        if (!['player', 'captain', 'manager'].includes(role))
            return res.status(400).json({ error: 'Invalid role.' });

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found.' });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(expiresInDays));

        const invite = await InviteCode.create({
            code:      InviteCode.generate(),
            teamId:    req.params.id,
            role,
            createdBy: req.user.userId,
            expiresAt,
        });
        res.status(201).json(invite);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/teams/:id/invites', async (req, res) => {
    try {
        const invites = await InviteCode.find({ teamId: req.params.id })
            .populate('usedBy', 'username')
            .sort({ createdAt: -1 });
        res.json(invites);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/invites/:id', async (req, res) => {
    try {
        const invite = await InviteCode.findById(req.params.id);
        if (!invite) return res.status(404).json({ error: 'Invite not found.' });
        if (invite.isUsed) return res.status(400).json({ error: 'Cannot revoke used invite.' });
        await invite.deleteOne();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/impersonate/:teamId', async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        const allowedRoles = ['manager', 'player', 'captain'];
        const role = allowedRoles.includes(req.body.role) ? req.body.role : 'manager';
        const token = jwt.sign(
            { userId: req.user.userId, teamId: team._id, role, isImpersonating: true },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ token, teamName: team.name, teamId: team._id, role });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const [
            teamCount, playerCount, managerCount, captainCount,
            inviteActive, inviteUsed, inviteExpired,
            photoCount, adminPhotoCount,
            praccCount,
        ] = await Promise.all([
            Team.countDocuments(),
            User.countDocuments({ role: 'player', isActive: true }),
            User.countDocuments({ role: 'manager', isActive: true }),
            User.countDocuments({ role: 'captain', isActive: true }),
            InviteCode.countDocuments({ isUsed: false, expiresAt: { $gt: now } }),
            InviteCode.countDocuments({ isUsed: true }),
            InviteCode.countDocuments({ isUsed: false, expiresAt: { $lte: now } }),
            MediaGallery.countDocuments({ isAdminUpload: false }),
            MediaGallery.countDocuments({ isAdminUpload: true }),
            PraccMatch.countDocuments(),
        ]);
        res.json({
            teamCount, playerCount, managerCount, captainCount,
            inviteActive, inviteUsed, inviteExpired,
            photoCount, adminPhotoCount,
            praccCount,
            totalUsers: playerCount + managerCount + captainCount,
        });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/storage', authMiddleware, requireOwner, async (req, res) => {
    const result = {};

    try {
        const usage = await cloudinary.api.usage();
        const usedBytes  = usage.storage?.usage  ?? 0;
        const limitBytes = usage.storage?.limit  ?? (25 * 1024 * 1024 * 1024);
        result.cloudinary = {
            usedBytes,
            limitBytes,
            usedMB:  +(usedBytes  / 1024 / 1024).toFixed(1),
            limitGB: +(limitBytes / 1024 / 1024 / 1024).toFixed(1),
            pct:     +((usedBytes / limitBytes) * 100).toFixed(2),
        };
    } catch {
        result.cloudinary = null;
    }

    try {
        const stats = await mongoose.connection.db.command({ dbStats: 1, scale: 1 });
        const usedBytes  = stats.storageSize ?? 0;
        const limitBytes = 512 * 1024 * 1024;
        result.mongo = {
            usedBytes,
            limitBytes,
            usedMB:  +(usedBytes  / 1024 / 1024).toFixed(1),
            limitMB: +(limitBytes / 1024 / 1024).toFixed(0),
            pct:     +((usedBytes / limitBytes) * 100).toFixed(2),
        };
    } catch {
        result.mongo = null;
    }

    res.json(result);
});


router.get('/team-stats', authMiddleware, requireOwner, async (req, res) => {
    try {
        const teams = await Team.find().select('name tag region logoUrl').lean();
        const teamIds = teams.map(t => t._id);

        const [users, gallery, praccMatches, tasks, announcements] = await Promise.all([
            User.find({ $or: [{ teamId: { $in: teamIds } }, { teamIds: { $in: teamIds } }], role: { $ne: 'owner' } })
                .select('teamId teamIds role isActive profilePhotoUrl lastLoginAt createdAt').lean(),
            MediaGallery.find({ teamId: { $in: teamIds } }).select('teamId uploadedBy isAdminUpload').lean(),
            PraccMatch.find({ teamId: { $in: teamIds } }).select('teamId result date').lean(),
            Task.find({ teamId: { $in: teamIds } }).select('teamId status').lean(),
            Announcement.find({ teamId: { $in: teamIds } }).select('teamId isPinned').lean(),
        ]);

        const map = {};
        for (const t of teams) {
            map[t._id] = {
                _id: t._id, name: t.name, tag: t.tag, region: t.region, logoUrl: t.logoUrl,
                players: 0, captains: 0, managers: 0,
                noPhoto: 0, inactive: 0,
                galleryPhotos: 0, managementPhotos: 0, playerPhotos: 0, adminPhotos: 0,
                praccTotal: 0, praccWins: 0, praccLosses: 0, praccDraws: 0, lastPracc: null,
                tasksOpen: 0, tasksDone: 0,
                announcements: 0, pinnedAnnouncements: 0,
            };
        }

        for (const u of users) {
            const tid = (u.teamId || '').toString();
            if (!map[tid]) continue;
            const s = map[tid];
            if (u.role === 'player')  s.players++;
            if (u.role === 'captain') s.captains++;
            if (u.role === 'manager') s.managers++;
            if (!u.profilePhotoUrl)   s.noPhoto++;
            if (!u.isActive)          s.inactive++;
        }

        for (const g of gallery) {
            const s = map[g.teamId?.toString()];
            if (!s) continue;
            if (g.isAdminUpload) { s.adminPhotos++; continue; }
            s.galleryPhotos++;
        }

        for (const p of praccMatches) {
            const s = map[p.teamId?.toString()];
            if (!s) continue;
            s.praccTotal++;
            if (p.result === 'W') s.praccWins++;
            if (p.result === 'L') s.praccLosses++;
            if (p.result === 'D') s.praccDraws++;
            if (!s.lastPracc || p.date > s.lastPracc) s.lastPracc = p.date;
        }

        for (const tk of tasks) {
            const s = map[tk.teamId?.toString()];
            if (!s) continue;
            if (tk.status === 'completed') s.tasksDone++;
            else s.tasksOpen++;
        }

        for (const a of announcements) {
            const s = map[a.teamId?.toString()];
            if (!s) continue;
            s.announcements++;
            if (a.isPinned) s.pinnedAnnouncements++;
        }

        for (const s of Object.values(map)) {
            const total = s.praccTotal;
            s.winRate = total ? Math.round((s.praccWins / total) * 100) : null;
        }

        res.json(Object.values(map));
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/managers', async (req, res) => {
    try {
        const managers = await User.find({ role: 'manager' })
            .select('-passwordHash')
            .populate('teamId', 'name tag region')
            .populate('teamIds', 'name tag region')
            .sort({ username: 1 });
        res.json(managers);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/managers/:userId/active', async (req, res) => {
    try {
        const { isActive } = req.body;
        const u = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: { isActive: Boolean(isActive) } },
            { new: true, select: '-passwordHash' }
        ).populate('teamId', 'name tag region');
        if (!u) return res.status(404).json({ error: 'User not found.' });
        res.json(u);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/managers/:userId/remove-team', async (req, res) => {
    try {
        const { teamId } = req.body;
        const u = await User.findById(req.params.userId);
        if (!u) return res.status(404).json({ error: 'User not found.' });
        u.teamIds = u.teamIds.filter(t => t.toString() !== teamId);
        if (u.teamId?.toString() === teamId) {
            u.teamId = u.teamIds[0] || null;
        }
        await u.save();
        const updated = await User.findById(u._id).select('-passwordHash').populate('teamId', 'name tag region');
        res.json(updated);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
