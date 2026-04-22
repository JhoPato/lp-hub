const express          = require('express');
const router           = express.Router();
const multer           = require('multer');
const PraccEntry       = require('../models/PraccEntry');
const PraccMatch       = require('../models/PraccMatch');
const parseScrimSense  = require('../utils/parseScrimSense');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { uploadScreenshot, cloudinary } = require('../config/cloudinary');

const uploadJson = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(new Error('Only .json files are accepted.'));
        }
    },
});

router.post('/matches/import', authMiddleware, requireRole('manager', 'captain'),
    uploadJson.single('matchJson'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No JSON file provided.' });

        let raw;
        try {
            raw = JSON.parse(req.file.buffer.toString('utf8'));
        } catch {
            return res.status(400).json({ error: 'Invalid JSON file.' });
        }

        if (!raw.matchInfo?.matchId || !raw.players || !raw.roundResults) {
            return res.status(400).json({ error: 'File does not look like a ScrimSense match export.' });
        }

        const exists = await PraccMatch.findOne({ teamId: req.user.teamId, matchId: raw.matchInfo.matchId });
        if (exists) return res.status(409).json({ error: 'This match has already been imported.', matchId: exists._id });

        const parsed = parseScrimSense(raw);

        let mapName = req.body.mapName || null;
        if (!mapName && parsed.mapId) {
            try {
                const r = await fetch('https://valorant-api.com/v1/maps');
                const d = await r.json();
                const found = (d.data || []).find(m => m.mapUrl === parsed.mapId);
                if (found) mapName = found.displayName;
            } catch {  }
        }

        const match = await PraccMatch.create({
            teamId:     req.user.teamId,
            uploadedBy: req.user.userId,
            ...parsed,
            mapName,
            opponent: req.body.opponent || '',
        });

        res.status(201).json({ message: 'Match imported successfully.', match });
    } catch (err) {
        console.error('[pracc import]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/matches', authMiddleware, async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const filter = { teamId: req.user.teamId };
        if (req.query.result) filter.result = req.query.result.toUpperCase();
        if (req.query.map)    filter.mapName = req.query.map;

        const total   = await PraccMatch.countDocuments(filter);
        const [matches, mapAgg] = await Promise.all([
            PraccMatch.find(filter)
                .select('-rounds -kills') 
                .sort({ date: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            PraccMatch.distinct('mapName', { teamId: req.user.teamId, mapName: { $ne: null } }),
        ]);

        res.json({ matches, total, page, pages: Math.ceil(total / limit), maps: mapAgg.filter(Boolean).sort() });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/matches/stats', authMiddleware, async (req, res) => {
    try {
        const matches = await PraccMatch.find({ teamId: req.user.teamId })
            .select('result scoreUs scoreThem mapName mapId date opponent ourAttackRoundsWon ourAttackRoundsPlayed ourDefenseRoundsWon ourDefenseRoundsPlayed players rounds')
            .sort({ date: -1 });

        if (!matches.length) return res.json({ total: 0, matches: [] });

        const playerAgg = {};

        matches.forEach(m => {
            const mapKey = m.mapName || 'Unknown';
            (m.players || []).filter(p => p.isOurTeam).forEach(p => {
                const key = `${p.gameName}#${p.tagLine}`;
                if (!playerAgg[key]) {
                    playerAgg[key] = {
                        gameName: p.gameName, tagLine: p.tagLine,
                        hubPlayerId: p.hubPlayerId,
                        matchCount: 0,
                        kills: 0, deaths: 0, assists: 0,
                        totalScore: 0, totalRounds: 0,
                        totalDamage: 0,
                        headshotCount: 0, bodyshotCount: 0, legshotCount: 0,
                        kastSum: 0,
                        firstKills: 0, firstDeaths: 0,
                        mk2: 0, mk3: 0, mk4: 0, mk5: 0,
                        clutchesAttempted: 0, clutchesWon: 0,
                        mapStats: {},
                        matchResults: [],
                    };
                }
                const a = playerAgg[key];
                a.matchCount++;
                a.kills          += p.kills;
                a.deaths         += p.deaths;
                a.assists        += p.assists;
                a.totalScore     += p.score;
                a.totalRounds    += p.roundsPlayed;
                a.totalDamage    += p.totalDamage;
                a.headshotCount  += p.headshotCount;
                a.bodyshotCount  += p.bodyshotCount;
                a.legshotCount   += p.legshotCount;
                a.kastSum        += p.kastPercent;
                a.firstKills     += p.firstKills;
                a.firstDeaths    += p.firstDeaths;
                a.mk2            += p.mk2;
                a.mk3            += p.mk3;
                a.mk4            += p.mk4;
                a.mk5            += p.mk5;
                a.clutchesAttempted += p.clutchesAttempted;
                a.clutchesWon    += p.clutchesWon;
                if (p.hubPlayerId && !a.hubPlayerId) a.hubPlayerId = p.hubPlayerId;

                if (!a.mapStats[mapKey]) {
                    a.mapStats[mapKey] = {
                        matchCount: 0, wins: 0,
                        kills: 0, deaths: 0, assists: 0,
                        totalScore: 0, totalRounds: 0,
                        totalDamage: 0,
                        headshotCount: 0, bodyshotCount: 0, legshotCount: 0,
                    };
                }
                const ms = a.mapStats[mapKey];
                ms.matchCount++;
                if (m.result === 'W') ms.wins++;
                ms.kills       += p.kills;
                ms.deaths      += p.deaths;
                ms.assists     += p.assists;
                ms.totalScore  += p.score;
                ms.totalRounds += p.roundsPlayed;
                ms.totalDamage += p.totalDamage;
                ms.headshotCount += p.headshotCount;
                ms.bodyshotCount += p.bodyshotCount;
                ms.legshotCount  += p.legshotCount;

                if (a.matchResults.length < 20) {
                    a.matchResults.push({ date: m.date, result: m.result, mapName: m.mapName, scoreUs: m.scoreUs, scoreThem: m.scoreThem });
                }
            });
        });

        const playerStats = Object.values(playerAgg).map(a => {
            const shots = a.headshotCount + a.bodyshotCount + a.legshotCount;
            return {
                gameName:          a.gameName,
                tagLine:           a.tagLine,
                hubPlayerId:       a.hubPlayerId,
                matchCount:        a.matchCount,
                kills:             a.kills,
                deaths:            a.deaths,
                assists:           a.assists,
                acs:               a.totalRounds ? Math.round(a.totalScore / a.totalRounds) : 0,
                kd:                a.deaths ? parseFloat((a.kills / a.deaths).toFixed(2)) : a.kills,
                kda:               a.deaths ? parseFloat(((a.kills + a.assists) / a.deaths).toFixed(2)) : (a.kills + a.assists),
                damagePerRound:    a.totalRounds ? parseFloat((a.totalDamage / a.totalRounds).toFixed(1)) : 0,
                headshotPercent:   shots ? parseFloat(((a.headshotCount / shots) * 100).toFixed(1)) : 0,
                kastPercent:       a.matchCount ? parseFloat((a.kastSum / a.matchCount).toFixed(1)) : 0,
                firstKills:        a.firstKills,
                firstDeaths:       a.firstDeaths,
                mk2: a.mk2, mk3: a.mk3, mk4: a.mk4, mk5: a.mk5,
                clutchesAttempted: a.clutchesAttempted,
                clutchesWon:       a.clutchesWon,
                clutchRate:        a.clutchesAttempted ? parseFloat(((a.clutchesWon / a.clutchesAttempted) * 100).toFixed(1)) : 0,
                matchResults:      [...a.matchResults].reverse(), 
                mapBreakdown:      Object.entries(a.mapStats).map(([mapName, ms]) => {
                    const shots = ms.headshotCount + ms.bodyshotCount + ms.legshotCount;
                    return {
                        mapName,
                        matchCount:       ms.matchCount,
                        wins:             ms.wins,
                        winRate:          ms.matchCount ? Math.round((ms.wins / ms.matchCount) * 100) : 0,
                        acs:              ms.totalRounds ? Math.round(ms.totalScore / ms.totalRounds) : 0,
                        kd:               ms.deaths ? parseFloat((ms.kills / ms.deaths).toFixed(2)) : ms.kills,
                        kills:            ms.kills,
                        deaths:           ms.deaths,
                        assists:          ms.assists,
                        damagePerRound:   ms.totalRounds ? parseFloat((ms.totalDamage / ms.totalRounds).toFixed(1)) : 0,
                        headshotPercent:  shots ? parseFloat(((ms.headshotCount / shots) * 100).toFixed(1)) : 0,
                    };
                }).sort((a, b) => b.matchCount - a.matchCount),
            };
        }).sort((a, b) => b.acs - a.acs);

        let pistolPlayed = 0, pistolWon = 0;
        let bonusPlayed  = 0, bonusWon  = 0;
        let ecoPlayed    = 0, ecoWon    = 0;
        let halfBuyPlayed = 0, halfBuyWon = 0;

        matches.forEach(m => {
            const ourSubjects = new Set((m.players || []).filter(p => p.isOurTeam).map(p => p.subject));
            (m.rounds || []).forEach(r => {
                const rn       = r.roundNum;
                const isPistol = rn === 0 || rn === 12;
                const isBonus  = rn === 1 || rn === 13;
                const ourStats = (r.playerStats || []).filter(ps => ourSubjects.has(ps.subject));
                const avgSpend = ourStats.length
                    ? ourStats.reduce((s, ps) => s + (ps.loadoutValue || 0), 0) / ourStats.length
                    : 0;

                if (isPistol) {
                    pistolPlayed++;
                    if (r.ourTeamWon) pistolWon++;
                } else if (isBonus) {
                    bonusPlayed++;
                    if (r.ourTeamWon) bonusWon++;
                }

                if (!isPistol && avgSpend >= 0 && avgSpend <= 1000) {
                    ecoPlayed++;
                    if (r.ourTeamWon) ecoWon++;
                }

                if (!isBonus && avgSpend >= 1100 && avgSpend <= 2600) {
                    halfBuyPlayed++;
                    if (r.ourTeamWon) halfBuyWon++;
                }
            });
        });

        const econStats = {
            pistolPlayed, pistolWon,
            pistolWR: pistolPlayed ? Math.round((pistolWon / pistolPlayed) * 100) : null,
            bonusPlayed, bonusWon,
            bonusWR: bonusPlayed ? Math.round((bonusWon / bonusPlayed) * 100) : null,
            ecoPlayed, ecoWon,
            ecoWR: ecoPlayed ? Math.round((ecoWon / ecoPlayed) * 100) : null,
            halfBuyPlayed, halfBuyWon,
            halfBuyWR: halfBuyPlayed ? Math.round((halfBuyWon / halfBuyPlayed) * 100) : null,
        };

        res.json({
            total:       matches.length,
            matches:     matches.map(m => ({
                _id: m._id, date: m.date, result: m.result,
                scoreUs: m.scoreUs, scoreThem: m.scoreThem,
                mapName: m.mapName, mapId: m.mapId, opponent: m.opponent,
                ourAttackRoundsWon: m.ourAttackRoundsWon,
                ourAttackRoundsPlayed: m.ourAttackRoundsPlayed,
                ourDefenseRoundsWon: m.ourDefenseRoundsWon,
                ourDefenseRoundsPlayed: m.ourDefenseRoundsPlayed,
            })),
            playerStats,
            econStats,
        });
    } catch (err) {
        console.error('[pracc stats]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/matches/:id', authMiddleware, async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        res.json(match);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/matches/:id', authMiddleware, requireRole('manager', 'captain'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });

        const { opponent, mapName } = req.body;
        if (opponent !== undefined) match.opponent = opponent;
        if (mapName  !== undefined) match.mapName  = mapName;
        await match.save();
        res.json({ message: 'Updated.', match });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/matches/:id/player-map', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });

        const { subject, hubPlayerId } = req.body;
        if (!subject) return res.status(400).json({ error: 'subject required.' });

        const player = match.players.find(p => p.subject === subject);
        if (!player) return res.status(404).json({ error: 'Player not found in match.' });

        player.hubPlayerId = hubPlayerId || null;
        match.markModified('players');
        await match.save();
        res.json({ message: 'Player mapping updated.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/matches/merge-player', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const { primaryGameName, primaryTagLine, altAccounts } = req.body;
        if (!primaryGameName?.trim() || !primaryTagLine?.trim())
            return res.status(400).json({ error: 'primaryGameName and primaryTagLine are required.' });
        if (primaryGameName.length > 64 || primaryTagLine.length > 16)
            return res.status(400).json({ error: 'Invalid gameName or tagLine length.' });
        if (!Array.isArray(altAccounts) || !altAccounts.length)
            return res.status(400).json({ error: 'altAccounts must be a non-empty array.' });
        if (altAccounts.length > 20)
            return res.status(400).json({ error: 'Too many alt accounts.' });

        const alts = altAccounts
            .map(a => ({ gameName: (a.gameName || '').trim(), tagLine: (a.tagLine || '').trim() }))
            .filter(a => a.gameName && a.tagLine);
        if (!alts.length)
            return res.status(400).json({ error: 'No valid alt accounts provided.' });

        const orFilter = alts.map(a => ({ 'players.gameName': a.gameName, 'players.tagLine': a.tagLine }));
        const matches = await PraccMatch.find({ teamId: req.user.teamId, $or: orFilter });

        let matchesUpdated = 0;
        let playersUpdated = 0;

        for (const match of matches) {
            let changed = false;
            for (const player of match.players) {
                const isAlt = alts.some(a => a.gameName === player.gameName && a.tagLine === player.tagLine);
                if (isAlt) {
                    player.gameName = primaryGameName.trim();
                    player.tagLine  = primaryTagLine.trim();
                    changed = true;
                    playersUpdated++;
                }
            }
            if (changed) {
                match.markModified('players');
                await match.save();
                matchesUpdated++;
            }
        }

        res.json({
            message: `Merged ${playersUpdated} player entr${playersUpdated !== 1 ? 'ies' : 'y'} across ${matchesUpdated} match${matchesUpdated !== 1 ? 'es' : ''}.`,
            matchesUpdated,
            playersUpdated,
        });
    } catch (err) {
        console.error('[pracc merge-player]', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.delete('/matches/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        await match.deleteOne();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/matches/:id/vod', authMiddleware, requireRole('manager', 'captain'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        match.vodUrl = req.body.vodUrl || '';
        await match.save();
        res.json({ message: 'VOD URL saved.', vodUrl: match.vodUrl });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/matches/:id/vod/notes', authMiddleware, requireRole('manager', 'captain'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        const { timestamp, title, note } = req.body;
        if (timestamp === undefined) return res.status(400).json({ error: 'timestamp required.' });
        match.vodNotes.push({ timestamp: Number(timestamp), title: title || '', note: note || '', createdBy: req.user.userId });
        match.vodNotes.sort((a, b) => a.timestamp - b.timestamp);
        await match.save();
        res.status(201).json({ vodNotes: match.vodNotes });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.put('/matches/:id/vod/notes/:noteId', authMiddleware, requireRole('manager', 'captain'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        const noteDoc = match.vodNotes.id(req.params.noteId);
        if (!noteDoc) return res.status(404).json({ error: 'Note not found.' });
        const { title, note } = req.body;
        if (title     !== undefined) noteDoc.title     = title;
        if (note      !== undefined) noteDoc.note      = note;
        if (req.body.timestamp !== undefined) noteDoc.timestamp = Number(req.body.timestamp);
        await match.save();
        res.json({ vodNotes: match.vodNotes });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/matches/:id/vod/notes/:noteId', authMiddleware, requireRole('manager', 'captain'), async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });
        match.vodNotes.pull(req.params.noteId);
        await match.save();
        res.json({ success: true, vodNotes: match.vodNotes });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/matches/:id/comments', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: 'Comment text is required.' });

        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });

        const User = require('../models/User');
        const author = await User.findById(req.user.userId).select('username').lean();
        match.comments.push({
            authorId:   req.user.userId,
            authorName: author?.username || 'Unknown',
            text:       text.trim().slice(0, 500),
        });
        await match.save();
        res.status(201).json(match.comments[match.comments.length - 1]);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/matches/:id/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const match = await PraccMatch.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!match) return res.status(404).json({ error: 'Match not found.' });

        const comment = match.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found.' });

        const isAuthor  = comment.authorId.equals(req.user.userId);
        const isManager = req.user.role === 'manager';
        if (!isAuthor && !isManager) return res.status(403).json({ error: 'Cannot delete this comment.' });

        comment.deleteOne();
        await match.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});



router.get('/', authMiddleware, async (req, res) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(50, parseInt(req.query.limit) || 20);
        const filter = { teamId: req.user.teamId };
        if (req.query.result && ['win','loss','draw'].includes(req.query.result)) {
            filter.overallResult = req.query.result;
        }
        const total = await PraccEntry.countDocuments(filter);
        const entries = await PraccEntry.find(filter)
            .populate('createdBy', 'username')
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        res.json({ entries, total, page, pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const entry = await PraccEntry.findOne({ _id: req.params.id, teamId: req.user.teamId })
            .populate('createdBy', 'username');
        if (!entry) return res.status(404).json({ error: 'Entry not found.' });
        res.json(entry);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/', authMiddleware, requireRole('manager','captain'), async (req, res) => {
    try {
        const { date, opponent, maps, overallResult, notes, vodUrl } = req.body;
        if (!date || !opponent || !overallResult)
            return res.status(400).json({ error: 'Date, opponent and overall result are required.' });

        const entry = await PraccEntry.create({
            teamId: req.user.teamId,
            createdBy: req.user.userId,
            date, opponent, maps: maps || [], overallResult,
            notes: notes || '', vodUrl: vodUrl || '',
        });
        res.status(201).json(entry);
    } catch (err) {
        if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

router.put('/:id', authMiddleware, requireRole('manager','captain'), async (req, res) => {
    try {
        const entry = await PraccEntry.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!entry) return res.status(404).json({ error: 'Entry not found.' });

        if (req.user.role === 'captain' && String(entry.createdBy) !== req.user.userId)
            return res.status(403).json({ error: 'You can only edit your own entries.' });

        const { date, opponent, maps, overallResult, notes, vodUrl } = req.body;
        Object.assign(entry, {
            date:          date          ?? entry.date,
            opponent:      opponent      ?? entry.opponent,
            maps:          maps          ?? entry.maps,
            overallResult: overallResult ?? entry.overallResult,
            notes:         notes         ?? entry.notes,
            vodUrl:        vodUrl        ?? entry.vodUrl,
        });
        await entry.save();
        res.json(entry);
    } catch (err) {
        if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

router.delete('/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const entry = await PraccEntry.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!entry) return res.status(404).json({ error: 'Entry not found.' });

        await Promise.all(entry.screenshots.map(s => cloudinary.uploader.destroy(s.publicId).catch(() => {})));

        await entry.deleteOne();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/screenshots', authMiddleware, requireRole('manager','captain'),
    uploadScreenshot.single('screenshot'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided.' });
        const entry = await PraccEntry.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!entry) return res.status(404).json({ error: 'Entry not found.' });

        entry.screenshots.push({
            url:      req.file.path,
            publicId: req.file.filename,
            caption:  req.body.caption || '',
        });
        await entry.save();
        res.json(entry.screenshots[entry.screenshots.length - 1]);
    } catch (err) { res.status(500).json({ error: 'Upload failed.' }); }
});

router.delete('/:id/screenshots/:sid', authMiddleware, requireRole('manager','captain'), async (req, res) => {
    try {
        const entry = await PraccEntry.findOne({ _id: req.params.id, teamId: req.user.teamId });
        if (!entry) return res.status(404).json({ error: 'Entry not found.' });

        const shot = entry.screenshots.id(req.params.sid);
        if (!shot) return res.status(404).json({ error: 'Screenshot not found.' });

        await cloudinary.uploader.destroy(shot.publicId).catch(() => {});
        shot.deleteOne();
        await entry.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
