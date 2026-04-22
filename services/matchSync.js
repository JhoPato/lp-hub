'use strict';
const User          = require('../models/User');
const Team          = require('../models/Team');
const MatchSnapshot = require('../models/MatchSnapshot');
const SyncStatus    = require('../models/SyncStatus');
const henrik        = require('./henrik');

// ── Config ───────────────────────────────────────────────────────────────────
const SYNC_EVERY_MS       = 8 * 60 * 60 * 1000; // full sync every 8 hours
const INTERVAL_BETWEEN_MS = 8 * 60 * 1000;      // 8 min between each queue item
const NO_DATA_TIMEOUT_MS  = 6 * 60 * 1000;      // retry if Henrik gives nothing in 6 min
const FETCH_SIZE          = 10;                   // Henrik v4 max per request

// ── State ────────────────────────────────────────────────────────────────────
let _queue        = [];
let _running      = false;
let _syncTimer    = null;
let _skipResolve  = null; // set by skipWait() to cancel current interval early

// ── Helpers ──────────────────────────────────────────────────────────────────

function _wait(ms) {
    return new Promise(r => {
        const t = setTimeout(r, ms);
        // Allow external skip: replace any previous resolver
        _skipResolve = () => { clearTimeout(t); r(); };
    });
}

function _toMs(t) {
    if (!t) return 0;
    if (typeof t === 'string') return new Date(t).getTime();
    return t < 1e12 ? t * 1000 : t;
}

// Wraps a Henrik fetch with a 10-min watchdog.
// Returns null if no response comes within NO_DATA_TIMEOUT_MS (→ triggers retry).
async function _fetchOrNull(fetchFn) {
    let result    = undefined;
    let didTimeout = false;

    await Promise.race([
        fetchFn().then(d => { result = d; }),
        _wait(NO_DATA_TIMEOUT_MS).then(() => { didTimeout = true; }),
    ]);

    if (didTimeout && result === undefined) return null;
    return result ?? null;
}

// Returns a Set of matchIds already stored for this player/account/type(s).
async function _storedIds(teamId, userId, account, types) {
    const docs = await MatchSnapshot.find(
        { teamId, userId, account, type: { $in: types } },
        { matchId: 1 }
    ).lean();
    return new Set(docs.map(d => d.matchId));
}

// Finds the player entry in Henrik match data.
function _findMe(m, gameName, tagLine) {
    const players = m.players?.all_players || m.players || [];
    return players.find(p =>
        p.name?.toLowerCase() === gameName.toLowerCase() &&
        p.tag?.toLowerCase()  === tagLine.toLowerCase()
    );
}

// Extracts won flag for a player, handling v3 and v4 team structures.
function _didWin(m, me) {
    const teamId = (me?.team_id || me?.team || '').toLowerCase();
    const teams  = m.teams;
    if (Array.isArray(teams)) {
        const mine = teams.find(t => (t.team_id || '').toLowerCase() === teamId);
        return mine?.won === true;
    }
    return teams?.[teamId]?.has_won === true;
}

// ── Core sync logic ──────────────────────────────────────────────────────────

async function _syncItem(item, isRetry = false) {
    const { teamId, apiKey, userId, account, gameName, tagLine, region, type } = item;
    const enc  = s => encodeURIComponent(s);
    const base = `v4/matches/${region}/pc/${enc(gameName)}/${enc(tagLine)}`;
    const tag  = `${gameName}#${tagLine} [${type}]${isRetry ? ' (retry)' : ''}`;

    console.log(`[Sync] → ${tag}`);

    try {
        const toInsert = [];

        if (type === 'ranked') {
            const known = await _storedIds(teamId, userId, account, ['ranked']);
            const raw   = await _fetchOrNull(
                () => henrik.fetchRaw(`${base}?mode=competitive&size=${FETCH_SIZE}`, apiKey)
            );

            if (raw === null) {
                if (!isRetry) {
                    console.log(`[Sync] No response in 10min for ${tag}, retrying…`);
                    return _syncItem(item, true);
                }
                return _saveStatus(teamId, userId, account, type, 'no_data', 0);
            }

            for (const m of (raw?.data || [])) {
                const matchId = m.metadata?.match_id || m.metadata?.matchid;
                if (!matchId || known.has(matchId)) continue;

                const me       = _findMe(m, gameName, tagLine);
                const playedAt = new Date(_toMs(m.metadata?.started_at || m.metadata?.game_start));
                const won      = me ? _didWin(m, me) : null;

                toInsert.push({ teamId, userId, account, matchId, type: 'ranked', playedAt, won });
            }

        } else {
            // training: fetch DM then TDM sequentially
            const known = await _storedIds(teamId, userId, account, ['dm', 'tdm']);

            for (const [mode, mtype] of [['deathmatch', 'dm'], ['teamdeathmatch', 'tdm']]) {
                const raw = await _fetchOrNull(
                    () => henrik.fetchRaw(`${base}?mode=${mode}&size=${FETCH_SIZE}`, apiKey)
                );

                if (raw === null) continue; // one mode failed — still process the other

                for (const m of (raw?.data || [])) {
                    const matchId = m.metadata?.match_id || m.metadata?.matchid;
                    if (!matchId || known.has(matchId)) continue;

                    const playedAt = new Date(_toMs(m.metadata?.started_at || m.metadata?.game_start));
                    toInsert.push({ teamId, userId, account, matchId, type: mtype, playedAt, won: null });
                }
            }

            // If both modes gave nothing AND it's the first attempt, retry
            if (toInsert.length === 0 && !isRetry) {
                // Check if we got any raw data at all (null = no response)
                // We already continued past null above, so toInsert.length===0
                // could just mean no new matches — don't retry for that
            }
        }

        // Bulk-insert, ignoring duplicate key errors (race between sync runs)
        if (toInsert.length > 0) {
            await MatchSnapshot.insertMany(toInsert, { ordered: false }).catch(err => {
                if (err.code !== 11000 && !err.message?.includes('duplicate')) throw err;
            });
        }

        console.log(`[Sync] ✓ ${tag}: ${toInsert.length} new match(es)`);
        return _saveStatus(teamId, userId, account, type, 'ok', toInsert.length);

    } catch (err) {
        console.error(`[Sync] ✗ ${tag}:`, err.message);
        return _saveStatus(teamId, userId, account, type, 'error', 0);
    }
}

async function _saveStatus(teamId, userId, account, type, status, saved) {
    await SyncStatus.findOneAndUpdate(
        { teamId, userId, account, type },
        { lastSyncAt: new Date(), lastStatus: status, newMatchesSaved: saved },
        { upsert: true, new: true }
    ).catch(() => {}); // non-critical — don't let status write failure bubble up
}

// ── Queue processor ──────────────────────────────────────────────────────────

async function _processQueue() {
    if (_running) return;
    _running = true;
    console.log(`[Sync] Queue started — ${_queue.length} item(s)`);

    while (_queue.length > 0) {
        const item = _queue.shift();
        await _syncItem(item);

        if (_queue.length > 0) {
            const mins = Math.round(INTERVAL_BETWEEN_MS / 60000);
            console.log(`[Sync] Waiting ${mins} min… (${_queue.length} remaining)`);
            await _wait(INTERVAL_BETWEEN_MS);
        }
    }

    _running = false;
    console.log('[Sync] Queue complete.');
}

// ── Queue builder ────────────────────────────────────────────────────────────

async function _buildQueue(skipRecentMs = SYNC_EVERY_MS) {
    const teams = await Team.find({ henrikApiKey: { $ne: null, $ne: '' } })
        .select('_id henrikApiKey').lean();

    // Load all recent sync statuses in one query for efficiency
    const cutoff   = new Date(Date.now() - skipRecentMs);
    const recent   = await SyncStatus.find({ lastSyncAt: { $gte: cutoff }, lastStatus: 'ok' })
        .select('userId account type').lean();
    const recentSet = new Set(recent.map(s => `${s.userId}:${s.account}:${s.type}`));

    const queue = [];
    let skipped = 0;

    for (const team of teams) {
        const players = await User.find({
            teamId:   team._id,
            isActive: true,
            role:     { $in: ['player', 'captain'] },
        }).select('_id riotGameName riotTagLine riotRegion riotGameName2 riotTagLine2 riotRegion2').lean();

        for (const p of players) {
            if (!p.riotGameName || !p.riotTagLine || !p.riotRegion) continue;

            const base = { teamId: team._id, apiKey: team.henrikApiKey, userId: p._id };

            for (const type of ['ranked', 'training']) {
                if (recentSet.has(`${p._id}:1:${type}`)) { skipped++; continue; }
                queue.push({ ...base, account: 1, gameName: p.riotGameName, tagLine: p.riotTagLine, region: p.riotRegion, type });
            }

            if (p.riotGameName2 && p.riotTagLine2 && p.riotRegion2) {
                for (const type of ['ranked', 'training']) {
                    if (recentSet.has(`${p._id}:2:${type}`)) { skipped++; continue; }
                    queue.push({ ...base, account: 2, gameName: p.riotGameName2, tagLine: p.riotTagLine2, region: p.riotRegion2, type });
                }
            }
        }
    }

    if (skipped > 0) console.log(`[Sync] Resuming — skipped ${skipped} recently synced item(s)`);
    return queue;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds the queue and starts processing in the background.
 * Safe to call if already running — the new queue won't start until the current one finishes.
 */
async function runSync() {
    if (_running) {
        console.log('[Sync] Already running, skipping trigger.');
        return;
    }
    _queue = await _buildQueue();
    console.log(`[Sync] Built queue — ${_queue.length} item(s)`);
    _processQueue(); // intentionally not awaited — runs in background
}

/**
 * Starts the automatic 8-hour scheduler and triggers an immediate first sync.
 */
function startScheduler() {
    console.log('[Sync] Scheduler started (every 8h, immediate first run)');
    runSync();
    _syncTimer = setInterval(runSync, SYNC_EVERY_MS);
}

function stopScheduler() {
    if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
    _running = false;
}

/**
 * Returns current sync status for a user across all types/accounts.
 */
async function getSyncStatus(teamId, userId) {
    return SyncStatus.find({ teamId, userId }).lean();
}

// ── DB query helpers (used by routes/henrik.js) ──────────────────────────────

/**
 * Returns ranked match count + W/L from DB for a user (both accounts combined).
 * lastN: how many recent matches to consider (default 20).
 */
async function getRankedFromDB(teamId, userId, lastN = 20) {
    const matches = await MatchSnapshot.find({ teamId, userId, type: 'ranked' })
        .sort({ playedAt: -1 })
        .limit(lastN)
        .lean();

    const count  = matches.length;
    const wins   = matches.filter(m => m.won).length;
    const losses = count - wins;

    // Sync status for display ("last updated X ago")
    const statuses = await SyncStatus.find({ teamId, userId, type: 'ranked' }).lean();
    const lastSyncAt = statuses.reduce((latest, s) => {
        if (!s.lastSyncAt) return latest;
        return !latest || s.lastSyncAt > latest ? s.lastSyncAt : latest;
    }, null);

    return {
        count, wins, losses,
        winRate:    count > 0 ? Math.round(wins / count * 100) : 0,
        matches:    matches.map(m => ({ matchId: m.matchId, date: m.playedAt.getTime(), won: m.won, account: m.account })),
        lastSyncAt,
    };
}

/**
 * Returns last-7-days DM + TDM counts per day from DB for a user (both accounts combined).
 */
async function getTrainingFromDB(teamId, userId) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 6);
    since.setUTCHours(0, 0, 0, 0);

    const matches = await MatchSnapshot.find({
        teamId, userId,
        type:     { $in: ['dm', 'tdm'] },
        playedAt: { $gte: since },
    }).lean();

    // Group by UTC date
    const dayMap = {};
    for (const m of matches) {
        const d   = new Date(m.playedAt);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        if (!dayMap[key]) dayMap[key] = { date: key, dm: 0, tdm: 0 };
        dayMap[key][m.type]++;
    }

    // Fill all 7 days (including gaps)
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        d.setUTCHours(0, 0, 0, 0);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        days.push(dayMap[key] || { date: key, dm: 0, tdm: 0 });
    }

    const statuses = await SyncStatus.find({ teamId, userId, type: 'training' }).lean();
    const lastSyncAt = statuses.reduce((latest, s) => {
        if (!s.lastSyncAt) return latest;
        return !latest || s.lastSyncAt > latest ? s.lastSyncAt : latest;
    }, null);

    return {
        days,
        totals: {
            dm:  days.reduce((s, d) => s + d.dm,  0),
            tdm: days.reduce((s, d) => s + d.tdm, 0),
        },
        lastSyncAt,
    };
}

/**
 * Returns today's ranked + DM/TDM counts from DB for a user.
 */
async function getTodayFromDB(teamId, userId) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const matches = await MatchSnapshot.find({
        teamId, userId,
        playedAt: { $gte: today },
    }).lean();

    return {
        ranked: matches.filter(m => m.type === 'ranked').length,
        dm:     matches.filter(m => m.type === 'dm' || m.type === 'tdm').length,
    };
}

/**
 * Skips the current inter-item wait immediately.
 * Returns true if there was an active wait to skip, false if queue is idle.
 */
function skipWait() {
    if (_skipResolve) {
        console.log('[Sync] Wait skipped manually.');
        _skipResolve();
        _skipResolve = null;
        return true;
    }
    return false;
}

/**
 * Returns current queue state for monitoring.
 */
function getQueueStatus() {
    return {
        running:   _running,
        remaining: _queue.length,
        next:      _queue[0] ? `${_queue[0].gameName}#${_queue[0].tagLine} [${_queue[0].type}]` : null,
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    runSync,
    skipWait,
    getQueueStatus,
    getSyncStatus,
    getRankedFromDB,
    getTrainingFromDB,
    getTodayFromDB,
};
