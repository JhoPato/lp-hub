const express    = require('express');
const jwt        = require('jsonwebtoken');
const router     = express.Router();
const User       = require('../models/User');
const InviteCode = require('../models/InviteCode');
const Team       = require('../models/Team');
const { authMiddleware } = require('../middleware/auth');

function signToken(user) {
    return jwt.sign(
        { userId: user._id, teamId: user.teamId, role: user.role, siteTeam: user.siteTeam },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function ensureTeamIds(user) {
    if (user.teamIds.length === 0 && user.teamId) {
        user.teamIds = [user.teamId];
        await user.save();
    }
}

router.post('/register', async (req, res) => {
    try {
        const { inviteCode, username, email, password } = req.body;
        if (!inviteCode || !username || !email || !password)
            return res.status(400).json({ error: 'All fields are required.' });

        const invite = await InviteCode.findOne({ code: inviteCode.toUpperCase(), isUsed: false });
        if (!invite) return res.status(400).json({ error: 'Invalid or already used invite code.' });
        if (new Date() > invite.expiresAt)
            return res.status(400).json({ error: 'Invite code has expired.' });

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(400).json({ error: 'Email already in use. If you want to join a new team, use "Join Another Team" on the register page.' });

        const isTeamless = ['social', 'owner'].includes(invite.role);

        const user = await User.create({
            username,
            email,
            passwordHash: User.hashPassword(password),
            role:     invite.role,
            teamId:   isTeamless ? null : invite.teamId,
            teamIds:  isTeamless ? [] : [invite.teamId],
            siteTeam: invite.siteTeam || { region: null, teamIndex: null },
        });

        invite.isUsed = true;
        invite.usedBy = user._id;
        invite.usedAt = new Date();
        await invite.save();

        const token = signToken(user);
        res.status(201).json({
            token,
            user: { id: user._id, username: user.username, role: user.role, teamId: user.teamId }
        });
    } catch (err) {
        console.error('[auth/register]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password are required.' });

        const user = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username: email }]
        });
        if (!user || !user.checkPassword(password))
            return res.status(401).json({ error: 'Invalid credentials.' });

        if (!user.isActive)
            return res.status(403).json({ error: 'Account deactivated. Contact your manager.' });

        
        if (!['social', 'owner'].includes(user.role)) await ensureTeamIds(user);

        if (user.teamIds.length > 1 && !['social', 'owner'].includes(user.role)) {
            const tempToken = jwt.sign(
                { userId: user._id, tempSelect: true },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            const teams = await Team.find({ _id: { $in: user.teamIds } })
                .select('name tag region logoUrl');

            return res.json({
                requiresTeamSelect: true,
                tempToken,
                teams: teams.map(t => ({
                    id: t._id,
                    name: t.name,
                    tag:  t.tag,
                    region: t.region,
                    logoUrl: t.logoUrl,
                    role: user.role,
                })),
                user: { id: user._id, username: user.username, role: user.role },
            });
        }

        const token = signToken(user);
        res.json({
            token,
            user: { id: user._id, username: user.username, role: user.role, teamId: user.teamId }
        });
    } catch (err) {
        console.error('[auth/login]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/select-team', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer '))
            return res.status(401).json({ error: 'No token provided.' });

        let decoded;
        try {
            decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }

        if (!decoded.tempSelect)
            return res.status(400).json({ error: 'Use the temporary token from login.' });

        const { teamId } = req.body;
        if (!teamId) return res.status(400).json({ error: 'teamId is required.' });

        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (!user.teamIds.some(t => t.toString() === teamId))
            return res.status(403).json({ error: 'That team is not associated with your account.' });

        user.teamId = teamId;
        await user.save();

        const token = signToken(user);
        res.json({
            token,
            user: { id: user._id, username: user.username, role: user.role, teamId: user.teamId }
        });
    } catch (err) {
        console.error('[auth/select-team]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/switch-team', authMiddleware, async (req, res) => {
    try {
        const { teamId } = req.body;
        if (!teamId) return res.status(400).json({ error: 'teamId is required.' });

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (!user.teamIds.some(t => t.toString() === teamId))
            return res.status(403).json({ error: 'That team is not associated with your account.' });

        user.teamId = teamId;
        await user.save();

        const token = signToken(user);
        res.json({
            token,
            user: { id: user._id, username: user.username, role: user.role, teamId: user.teamId }
        });
    } catch (err) {
        console.error('[auth/switch-team]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/join-team', async (req, res) => {
    try {
        const { email, password, inviteCode } = req.body;
        if (!inviteCode)
            return res.status(400).json({ error: 'Invite code is required.' });

        let user = null;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
                if (!decoded.tempSelect) {
                    user = await User.findById(decoded.userId);
                }
            } catch {  }
        }

        if (!user) {
            if (!email || !password)
                return res.status(400).json({ error: 'Email/username and password are required.' });
            user = await User.findOne({
                $or: [{ email: email.toLowerCase() }, { username: email }]
            });
            if (!user || !user.checkPassword(password))
                return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!user.isActive)
            return res.status(403).json({ error: 'Account deactivated. Contact your manager.' });

        const invite = await InviteCode.findOne({ code: inviteCode.toUpperCase(), isUsed: false });
        if (!invite) return res.status(400).json({ error: 'Invalid or already used invite code.' });
        if (new Date() > invite.expiresAt)
            return res.status(400).json({ error: 'Invite code has expired.' });

        await ensureTeamIds(user);

        if (user.teamIds.some(t => t.toString() === invite.teamId.toString()))
            return res.status(400).json({ error: 'You are already a member of this team.' });

        user.teamIds.push(invite.teamId);
        user.teamId = invite.teamId; 
        user.role   = invite.role;   

        await user.save();

        invite.isUsed = true;
        invite.usedBy = user._id;
        invite.usedAt = new Date();
        await invite.save();

        const teams = await Team.find({ _id: { $in: user.teamIds } })
            .select('name tag region logoUrl');

        const token = signToken(user);
        res.json({
            token,
            user: { id: user._id, username: user.username, role: user.role, teamId: user.teamId },
            teams: teams.map(t => ({
                id: t._id, name: t.name, tag: t.tag, region: t.region, logoUrl: t.logoUrl, role: user.role,
            })),
            message: 'Successfully joined the team!',
        });
    } catch (err) {
        console.error('[auth/join-team]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/my-teams', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await ensureTeamIds(user);

        const teams = await Team.find({ _id: { $in: user.teamIds } })
            .select('name tag region logoUrl');

        res.json({
            teams: teams.map(t => ({
                id: t._id, name: t.name, tag: t.tag, region: t.region, logoUrl: t.logoUrl, role: user.role,
                active: t._id.toString() === (user.teamId || '').toString(),
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-passwordHash').populate('teamId', 'name tag region logoUrl multiRegionEnabled');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Both passwords are required.' });

        const user = await User.findById(req.user.userId);
        if (!user.checkPassword(currentPassword))
            return res.status(401).json({ error: 'Current password is incorrect.' });

        user.passwordHash = User.hashPassword(newPassword);
        await user.save();
        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
