const express  = require('express');
const router   = express.Router();

const SiteNews = require('../models/SiteNews');
const Team     = require('../models/Team');
const User     = require('../models/User');
const { authMiddleware, requireRole, requireOwner } = require('../middleware/auth');
const { uploadSiteContent } = require('../config/cloudinary');

const LPAPI      = process.env.LPAPI_URL   || 'https://applostpuppies.discloud.app';
const LPAPI_TOKEN = process.env.LPAPI_OWNER_TOKEN || '';

async function lpApi(path, options = {}) {
    const res  = await fetch(`${LPAPI}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-LP-Token': LPAPI_TOKEN,
            ...(options.headers || {}),
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `LP-API error ${res.status}`);
    return data;
}

function normalizeRosterMember(entry, fallbackRole = '') {
    if (!entry) return null;
    if (typeof entry === 'string') {
        return { name: entry, role: fallbackRole };
    }

    return {
        name: entry.name || '',
        role: entry.role || fallbackRole,
        country: entry.country || entry.nationality || '',
        nationality: entry.nationality || entry.country || '',
        twitter: entry.twitter || '',
        vlr: entry.vlr || '',
        photo: entry.photo || '',
    };
}

function memberMap(list, fallbackRole = '') {
    const map = new Map();
    for (const entry of list || []) {
        const normalized = normalizeRosterMember(entry, fallbackRole);
        const key = normalized?.name?.trim().toLowerCase();
        if (key) map.set(key, normalized);
    }
    return map;
}

async function buildWebsiteRosterFromHub(teamId, websiteRoster = {}) {
    const members = await User.find({
        isActive: true,
        $or: [{ teamIds: teamId }, { teamId }],
    })
        .select('username apiPanelPlayerName role')
        .sort({ role: 1, username: 1 })
        .lean();

    const existingPlayers = memberMap(websiteRoster.players, 'Player');
    const existingCoaches = memberMap(websiteRoster.coaches, 'Manager');

    const players = members
        .filter((member) => member.role === 'player' || member.role === 'captain')
        .map((member) => {
            const name = member.apiPanelPlayerName || member.username;
            const key = name.trim().toLowerCase();
            const existing = existingPlayers.get(key) || {};
            return {
                ...existing,
                name,
                role: member.role === 'captain' ? 'Captain' : (existing.role || 'Player'),
            };
        });

    const coaches = members
        .filter((member) => member.role === 'manager')
        .map((member) => {
            const name = member.apiPanelPlayerName || member.username;
            const key = name.trim().toLowerCase();
            const existing = existingCoaches.get(key) || {};
            return {
                ...existing,
                name,
                role: existing.role || 'Manager',
            };
        });

    return { players, coaches };
}




router.get('/news', authMiddleware, async (req, res) => {
    try {
        const news = await lpApi('/api/news');
        res.json(news);
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.get('/news/drafts', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const filter = req.user.role === 'social'
            ? { createdBy: req.user.userId }
            : {};
        const drafts = await SiteNews.find(filter).sort({ createdAt: -1 });
        res.json(drafts);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/news/draft', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const { title, content, image, video_id } = req.body;
        if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });

        const User  = require('../models/User');
        const author = await User.findById(req.user.userId).select('username').lean();

        const draft = await SiteNews.create({
            title:         title.trim(),
            content:       content || '',
            image:         image   || '',
            video_id:      video_id || '',
            status:        req.user.role === 'owner' ? 'pending_review' : 'draft',
            createdBy:     req.user.userId,
            createdByName: author?.username || 'Unknown',
        });
        res.status(201).json(draft);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.put('/news/draft/:id', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const draft = await SiteNews.findById(req.params.id);
        if (!draft) return res.status(404).json({ error: 'Draft not found.' });
        if (draft.status === 'published') return res.status(400).json({ error: 'Cannot edit a published news item.' });

        const isAuthor  = draft.createdBy.equals(req.user.userId);
        const isOwner   = req.user.role === 'owner';
        if (!isAuthor && !isOwner) return res.status(403).json({ error: 'Cannot edit this draft.' });

        const { title, content, image, video_id } = req.body;
        if (title    !== undefined) draft.title    = title;
        if (content  !== undefined) draft.content  = content;
        if (image    !== undefined) draft.image    = image;
        if (video_id !== undefined) draft.video_id = video_id;
        
        if (req.user.role === 'social' && draft.status === 'rejected') {
            draft.status     = 'draft';
            draft.reviewNote = '';
        }
        await draft.save();
        res.json(draft);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.delete('/news/draft/:id', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const draft = await SiteNews.findById(req.params.id);
        if (!draft) return res.status(404).json({ error: 'Draft not found.' });
        if (draft.status === 'published') return res.status(400).json({ error: 'Cannot delete a published draft directly. Use delete live.' });

        const isAuthor = draft.createdBy.equals(req.user.userId);
        if (!isAuthor && req.user.role !== 'owner') return res.status(403).json({ error: 'Cannot delete this draft.' });

        await draft.deleteOne();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/news/submit/:id', authMiddleware, requireRole('social'), async (req, res) => {
    try {
        const draft = await SiteNews.findOne({ _id: req.params.id, createdBy: req.user.userId });
        if (!draft) return res.status(404).json({ error: 'Draft not found.' });
        if (!['draft', 'rejected'].includes(draft.status))
            return res.status(400).json({ error: 'This draft cannot be submitted.' });

        draft.status     = 'pending_review';
        draft.reviewNote = '';
        await draft.save();
        res.json(draft);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/news/publish/:id', authMiddleware, requireOwner, async (req, res) => {
    try {
        const draft = await SiteNews.findById(req.params.id);
        if (!draft) return res.status(404).json({ error: 'Draft not found.' });
        if (draft.status === 'published') return res.status(400).json({ error: 'Already published.' });

        const result = await lpApi('/api/manage-news', {
            method: 'POST',
            body: JSON.stringify({
                token:    LPAPI_TOKEN,
                action:   'add',
                newsItem: {
                    title:    draft.title,
                    content:  draft.content,
                    image:    draft.image   || undefined,
                    video_id: draft.video_id || undefined,
                },
            }),
        });

        draft.status      = 'published';
        draft.publishedId = result?.id || result?.newsItem?.id || null;
        draft.publishedAt = new Date();
        draft.reviewedBy  = req.user.userId;
        await draft.save();
        res.json(draft);
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.post('/news/reject/:id', authMiddleware, requireOwner, async (req, res) => {
    try {
        const draft = await SiteNews.findById(req.params.id);
        if (!draft) return res.status(404).json({ error: 'Draft not found.' });

        draft.status      = 'rejected';
        draft.reviewNote  = req.body.note || '';
        draft.reviewedBy  = req.user.userId;
        await draft.save();
        res.json(draft);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.put('/news/live/:publishedId', authMiddleware, requireOwner, async (req, res) => {
    try {
        const { title, content, image, video_id, date } = req.body;
        const newsItem = { id: req.params.publishedId, title, content, image, video_id };
        if (date) newsItem.date = date;
        const result = await lpApi('/api/manage-news', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'edit', newsItem }),
        });
        await SiteNews.findOneAndUpdate({ publishedId: req.params.publishedId }, { title, content, image, video_id });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.delete('/news/live/:publishedId', authMiddleware, requireOwner, async (req, res) => {
    try {
        await lpApi('/api/manage-news', {
            method: 'POST',
            body: JSON.stringify({
                token:    LPAPI_TOKEN,
                action:   'delete',
                newsItem: { id: req.params.publishedId },
            }),
        });
        await SiteNews.findOneAndUpdate({ publishedId: req.params.publishedId }, { status: 'draft', publishedId: null, publishedAt: null });
        res.json({ success: true });
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.post('/news/reorder', authMiddleware, requireOwner, async (req, res) => {
    try {
        const { newOrderIds } = req.body;
        const result = await lpApi('/api/manage-news', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'reorder', newOrderIds }),
        });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});




router.post('/upload', authMiddleware, requireRole('social', 'owner'), (req, res) => {
    const section = req.query.section;
    const validSections = new Set(['staff', 'trophies', 'creators', 'news']);

    if (!validSections.has(section)) {
        return res.status(400).json({ error: 'Invalid upload section.' });
    }

    uploadSiteContent.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Image too large. Max size is 5MB.' });
            }
            return res.status(400).json({ error: err.message || 'Upload failed.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided.' });
        }

        return res.status(201).json({
            url: req.file.path,
            publicId: req.file.filename,
            section,
            originalName: req.file.originalname,
        });
    });
});



router.get('/roster', authMiddleware, requireRole('manager', 'owner'), async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (!team?.apiPanelCode) return res.status(400).json({ error: 'No panel code linked for this team.' });
        const data = await lpApi(`/api/panel/${team.apiPanelCode}`);
        res.json({ liveRoster: data, websiteRoster: team.websiteRoster });
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.put('/roster', authMiddleware, requireRole('manager', 'owner'), async (req, res) => {
    try {
        const { players, coaches } = req.body;
        const team = await Team.findById(req.user.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });

        team.websiteRoster.players = players || [];
        team.websiteRoster.coaches = coaches || [];
        await team.save();
        res.json({ websiteRoster: team.websiteRoster });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/roster/sync', authMiddleware, requireRole('manager', 'owner'), async (req, res) => {
    try {
        const team = await Team.findById(req.user.teamId);
        if (!team?.apiPanelCode) return res.status(400).json({ error: 'No panel code linked for this team.' });
        if (!team.websiteRoster?.players?.length && !team.websiteRoster?.coaches?.length)
            return res.status(400).json({ error: 'Website roster is empty. Configure it first.' });

        await lpApi(`/api/panel/${team.apiPanelCode}/roster`, {
            method: 'PUT',
            body: JSON.stringify({
                players: team.websiteRoster.players,
                coaches: team.websiteRoster.coaches,
            }),
        });

        team.websiteRoster.lastSynced = new Date();
        await team.save();
        res.json({ success: true, lastSynced: team.websiteRoster.lastSynced });
    } catch (err) { res.status(502).json({ error: err.message }); }
});



router.get('/about/staff', authMiddleware, requireOwner, async (req, res) => {
    try { res.json(await lpApi('/api/about-staff')); }
    catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/about/trophies', authMiddleware, requireOwner, async (req, res) => {
    try { res.json(await lpApi('/api/about-trophies')); }
    catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/about/history', authMiddleware, requireOwner, async (req, res) => {
    try { res.json(await lpApi('/api/about-history')); }
    catch (err) { res.json([]); } 
});

router.put('/about/staff', authMiddleware, requireOwner, async (req, res) => {
    try {
        const result = await lpApi('/api/manage-about', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'save-staff', data: req.body.data }),
        });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

router.put('/about/trophies', authMiddleware, requireOwner, async (req, res) => {
    try {
        const result = await lpApi('/api/manage-about', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'save-trophies', data: req.body.data }),
        });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

router.put('/about/history', authMiddleware, requireOwner, async (req, res) => {
    try {
        const result = await lpApi('/api/manage-about', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'save-history', data: req.body.data }),
        });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

router.get('/about/hall-of-fame', authMiddleware, requireOwner, async (req, res) => {
    try { res.json(await lpApi('/api/about-hall-of-fame')); }
    catch (err) { res.json([]); }
});

router.get('/about/creators', authMiddleware, requireOwner, async (req, res) => {
    try { res.json(await lpApi('/api/about-creators')); }
    catch (err) { res.json([]); }
});

router.put('/about/hall-of-fame', authMiddleware, requireOwner, async (req, res) => {
    try {
        const result = await lpApi('/api/manage-about', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'save-hall-of-fame', data: req.body.data }),
        });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

router.put('/about/creators', authMiddleware, requireOwner, async (req, res) => {
    try {
        const result = await lpApi('/api/manage-about', {
            method: 'POST',
            body: JSON.stringify({ token: LPAPI_TOKEN, action: 'save-creators', data: req.body.data }),
        });
        res.json(result);
    } catch (err) { res.status(502).json({ error: err.message }); }
});




router.get('/roster/lp-teams', authMiddleware, requireOwner, async (req, res) => {
    try {
        const allRosters = await fetch(`${LPAPI}/api/rosters`).then(r => r.json());
        const flat = [];
        for (const [region, teams] of Object.entries(allRosters)) {
            teams.forEach((t, i) => flat.push({ region, teamIndex: i, name: t.name }));
        }
        res.json(flat);
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.get('/roster/all', authMiddleware, requireOwner, async (req, res) => {
    try {
        const teams = await Team.find()
            .select('name tag game region logoUrl lpApiTeam websiteRoster')
            .lean();
        res.json(teams);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.put('/roster/:teamId', authMiddleware, requireOwner, async (req, res) => {
    try {
        const { players = [], coaches = [] } = req.body;
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });

        team.websiteRoster.players = players;
        team.websiteRoster.coaches = coaches;
        await team.save();

        res.json({ team });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/roster/link', authMiddleware, requireOwner, async (req, res) => {
    try {
        const { teamId, region, teamIndex } = req.body;
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });

        team.lpApiTeam.region    = region    ?? null;
        team.lpApiTeam.teamIndex = teamIndex ?? null;
        await team.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/roster/:teamId/sync-hub', authMiddleware, requireOwner, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });

        const { players, coaches } = await buildWebsiteRosterFromHub(team._id, team.websiteRoster || {});
        team.websiteRoster.players = players;
        team.websiteRoster.coaches = coaches;
        await team.save();

        res.json({ team, syncedFromHub: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});


router.post('/roster/:teamId/pull', authMiddleware, requireOwner, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        if (team.lpApiTeam?.region == null || team.lpApiTeam?.teamIndex == null)
            return res.status(400).json({ error: 'No LP-API team linked.' });

        const allRosters = await fetch(`${LPAPI}/api/rosters`).then(r => r.json());
        const match = allRosters[team.lpApiTeam.region]?.[team.lpApiTeam.teamIndex];
        if (!match) return res.status(404).json({ error: 'Linked LP-API team not found.' });

        team.websiteRoster.players = match.players || [];
        team.websiteRoster.coaches = match.coaches || [];
        team.websiteRoster.lastSynced = new Date();
        await team.save();

        res.json({ team, pulled: true });
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.post('/roster/:teamId/push', authMiddleware, requireOwner, async (req, res) => {
    try {
        const team = await Team.findById(req.params.teamId);
        if (!team) return res.status(404).json({ error: 'Team not found.' });
        if (team.lpApiTeam?.region == null || team.lpApiTeam?.teamIndex == null)
            return res.status(400).json({ error: 'No LP-API team linked.' });

        await lpApi('/api/edit-roster', {
            method: 'POST',
            body: JSON.stringify({
                token: LPAPI_TOKEN,
                region: team.lpApiTeam.region,
                teamIndex: team.lpApiTeam.teamIndex,
                updatedPlayers: team.websiteRoster?.players || [],
                updatedCoaches: team.websiteRoster?.coaches || [],
            }),
        });

        team.websiteRoster.lastSynced = new Date();
        await team.save();

        res.json({ team, pushed: true });
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.post('/roster/pull-all', authMiddleware, requireOwner, async (req, res) => {
    try {
        const allRosters = await fetch(`${LPAPI}/api/rosters`).then(r => r.json());
        const hubTeams   = await Team.find({ 'lpApiTeam.region': { $ne: null } });
        const results    = [];

        for (const hubTeam of hubTeams) {
            const { region, teamIndex } = hubTeam.lpApiTeam;
            const match = allRosters[region]?.[teamIndex];
            if (!match) {
                results.push({ name: hubTeam.name, status: 'not_found' });
                continue;
            }
            hubTeam.websiteRoster.players    = match.players || [];
            hubTeam.websiteRoster.coaches    = match.coaches || [];
            hubTeam.websiteRoster.lastSynced = new Date();
            await hubTeam.save();
            results.push({
                name:    hubTeam.name,
                status:  'pulled',
                players: match.players?.length || 0,
                coaches: match.coaches?.length || 0,
            });
        }

        res.json({ results });
    } catch (err) { res.status(502).json({ error: err.message }); }
});


router.post('/roster/push-all', authMiddleware, requireOwner, async (req, res) => {
    try {
        const hubTeams = await Team.find({ 'lpApiTeam.region': { $ne: null } });
        const results  = [];

        for (const hubTeam of hubTeams) {
            try {
                await lpApi('/api/edit-roster', {
                    method: 'POST',
                    body: JSON.stringify({
                        token:          LPAPI_TOKEN,
                        region:         hubTeam.lpApiTeam.region,
                        teamIndex:      hubTeam.lpApiTeam.teamIndex,
                        updatedPlayers: hubTeam.websiteRoster?.players || [],
                        updatedCoaches: hubTeam.websiteRoster?.coaches || [],
                    }),
                });
                hubTeam.websiteRoster.lastSynced = new Date();
                await hubTeam.save();
                results.push({ name: hubTeam.name, status: 'pushed' });
            } catch (e) {
                results.push({ name: hubTeam.name, status: 'error', error: e.message });
            }
        }

        res.json({ results });
    } catch (err) { res.status(502).json({ error: err.message }); }
});



router.get('/clips', authMiddleware, requireOwner, async (req, res) => {
    try {
        const data = await lpApi('/api/clips');
        res.json(data);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

router.delete('/clips/:id', authMiddleware, requireOwner, async (req, res) => {
    try {
        const data = await lpApi(`/api/clips/${req.params.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ token: LPAPI_TOKEN }),
        });
        res.json(data);
    } catch (err) { res.status(502).json({ error: err.message }); }
});



router.get('/assets', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const data = await lpApi('/api/assets');
        res.json(data);
    } catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = router;
