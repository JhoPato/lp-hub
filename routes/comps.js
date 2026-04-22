'use strict';
const express    = require('express');
const router     = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const CompMatch  = require('../models/CompMatch');
const { syncAll, getSyncStatus } = require('../services/compSync');
const CIRCUITS   = require('../config/comp-circuits');

router.use(authMiddleware);

// ── GET /api/comps/circuits ───────────────────────────────────────────────────
// List all configured circuits (for UI / AI context)
router.get('/circuits', (req, res) => {
    res.json({ circuits: CIRCUITS.map(c => c.name) });
});

// ── GET /api/comps/status ─────────────────────────────────────────────────────
// How many matches per circuit + last sync info
router.get('/status', async (req, res) => {
    try {
        const stats = await CompMatch.aggregate([
            { $group: { _id: '$circuit', count: { $sum: 1 }, latest: { $max: '$date' } } },
            { $sort:  { _id: 1 } },
        ]);
        const total = await CompMatch.countDocuments();
        res.json({ total, circuits: stats, sync: getSyncStatus() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/comps/query ──────────────────────────────────────────────────────
// Used by the AI agent to look up comps.
// Query params: circuit, map, team, limit (max 50)
router.get('/query', async (req, res) => {
    const { circuit, map, team, limit = 20 } = req.query;
    const filter = {};

    if (circuit) filter.circuit = { $regex: circuit, $options: 'i' };
    if (map)     filter['maps.mapName'] = { $regex: map, $options: 'i' };
    if (team)    filter.$or = [
        { team1Name: { $regex: team, $options: 'i' } },
        { team2Name: { $regex: team, $options: 'i' } },
    ];

    try {
        const matches = await CompMatch.find(filter)
            .sort({ date: -1 })
            .limit(Math.min(parseInt(limit) || 20, 50))
            .lean();

        // If map filter: trim maps array to only the requested map
        const result = matches.map(m => {
            const relevantMaps = map
                ? m.maps.filter(mp => mp.mapName?.toLowerCase().includes(map.toLowerCase()))
                : m.maps;
            return {
                vlrMatchId: m.vlrMatchId,
                circuit:    m.circuit,
                team1Name:  m.team1Name,
                team2Name:  m.team2Name,
                date:       m.date,
                maps:       relevantMaps,
            };
        }).filter(m => m.maps.length);

        res.json({ count: result.length, matches: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/comps/winrates ───────────────────────────────────────────────────
// Aggregates win rates per agent composition per map.
// Query params: map, circuit, minSamples (default 3), limit (default 10, max 50)
// Requires MongoDB 5.2+ for $sortArray (normalises comp order).
router.get('/winrates', async (req, res) => {
    const { map, circuit, minSamples = 3, limit = 10 } = req.query;

    const preMatch = {};
    if (circuit) preMatch.circuit = { $regex: circuit, $options: 'i' };
    if (map)     preMatch['maps.mapName'] = { $regex: map, $options: 'i' };

    const pipeline = [
        ...(Object.keys(preMatch).length ? [{ $match: preMatch }] : []),
        { $unwind: '$maps' },
        // Re-filter after unwind so only the requested map is processed
        ...(map ? [{ $match: { 'maps.mapName': { $regex: map, $options: 'i' } } }] : []),
        // Emit one entry per team per map row
        { $project: {
            mapName:  '$maps.mapName',
            circuit:  1,
            entries: { $concatArrays: [
                [{ agents: '$maps.team1Agents', won: { $eq: ['$maps.team1Won', true]  } }],
                [{ agents: '$maps.team2Agents', won: { $eq: ['$maps.team1Won', false] } }],
            ]},
        }},
        { $unwind: '$entries' },
        // Skip malformed rows with no agents
        { $match: { 'entries.agents': { $exists: true }, $expr: { $gt: [{ $size: '$entries.agents' }, 0] } } },
        // Sort agents alphabetically → canonical composition key
        { $project: {
            mapName: 1,
            circuit: 1,
            agents:  { $sortArray: { input: '$entries.agents', sortBy: 1 } },
            won:     '$entries.won',
        }},
        // Group: map + sorted composition
        { $group: {
            _id:      { mapName: '$mapName', agents: '$agents' },
            total:    { $sum: 1 },
            wins:     { $sum: { $cond: ['$won', 1, 0] } },
            circuits: { $addToSet: '$circuit' },
        }},
        { $project: {
            _id:      0,
            mapName:  '$_id.mapName',
            agents:   '$_id.agents',
            total:    1,
            wins:     1,
            winRate:  { $round: [{ $multiply: [{ $divide: ['$wins', '$total'] }, 100] }, 1] },
            circuits: 1,
        }},
        // Minimum sample threshold (avoids noise from 1-2 match flukes)
        { $match: { total: { $gte: parseInt(minSamples) || 3 } } },
        { $sort:  { winRate: -1, total: -1 } },
        { $limit: Math.min(parseInt(limit) || 10, 50) },
    ];

    try {
        const results = await CompMatch.aggregate(pipeline);
        res.json({ count: results.length, winrates: results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /api/comps/sync ──────────────────────────────────────────────────────
// Trigger manual full sync — owner/manager only
router.post('/sync', requireRole('owner', 'manager'), (req, res) => {
    const { running } = getSyncStatus();
    if (running) return res.status(409).json({ error: 'Sync already running' });
    syncAll().catch(e => console.error('[compSync] manual sync error:', e.message));
    res.json({ message: 'Sync started in background' });
});

module.exports = router;
