'use strict';
const https = require('https');

// ── In-memory cache (key → { data, expires }) ───────────────────────────────
const _cache    = new Map();
const _inflight = new Map(); // dedup concurrent requests for the same cache key
const _urlInflight = new Map(); // dedup concurrent HTTP requests for the exact same URL+key

function _cached(key, ttlMs, fn) {
    const now = Date.now();
    const hit = _cache.get(key);
    if (hit && hit.expires > now) return Promise.resolve(hit.data);

    // If a fetch for this exact key is already in-flight, return the same promise
    // instead of making a duplicate Henrik API call.
    if (_inflight.has(key)) return _inflight.get(key);

    const promise = fn().then(data => {
        _cache.set(key, { data, expires: now + ttlMs });
        _inflight.delete(key);
        return data;
    }).catch(err => {
        _inflight.delete(key);
        throw err;
    });

    _inflight.set(key, promise);
    return promise;
}

// ── Raw HTTP GET against Henrik API ─────────────────────────────────────────


function _get(path, apiKey) {
    // Deduplicate at HTTP level: if two different cache-key flows request the
    // exact same Henrik URL at the same time, only one TCP connection goes out.
    const urlKey = (apiKey || '') + '::' + path;
    if (_urlInflight.has(urlKey)) return _urlInflight.get(urlKey);

    const promise = _getHttp(path, apiKey);
    _urlInflight.set(urlKey, promise);
    // Use then(ok, err) instead of finally() — finally() creates a derived promise
    // that re-throws on rejection, causing an unhandled rejection crash in Node.js.
    promise.then(
        () => _urlInflight.delete(urlKey),
        () => _urlInflight.delete(urlKey),
    );
    return promise;
}

function _getHttp(path, apiKey) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (fn) => (...args) => { if (!settled) { settled = true; fn(...args); } };

        const fullPath = '/valorant/' + path;

        const req = https.get({
            hostname: 'api.henrikdev.xyz',
            path:     fullPath,
            family:   4,              // force IPv4 — avoids IPv6 routing issues on some servers
            headers: {
                // Use a browser-like UA — Henrik's CDN may drop non-browser agents for some paths
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':     'application/json, */*',
                ...(apiKey ? { Authorization: apiKey } : {}),
            },
        }, (res) => {
            console.log(`[Henrik] ${res.statusCode} ${fullPath}`);
            let body = '';
            res.on('data', c => (body += c));
            res.on('end', done(() => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode !== 200) {
                        const msg = json?.errors?.[0]?.message
                            || json?.message
                            || `Henrik API error ${res.statusCode}`;
                        reject(new Error(msg));
                    } else {
                        resolve(json);
                    }
                } catch {
                    reject(new Error('Invalid JSON from Henrik API'));
                }
            }));
        });
        req.on('error', done((err) => {
            console.error(`[Henrik] Socket error path=${fullPath}:`, err.message);
            reject(err);
        }));
    });
}

// ── Timestamp helpers ────────────────────────────────────────────────────────

// Convert Henrik timestamp to ms.
// v3: integer (seconds if < 1e12, else ms)
// v4: ISO 8601 string ("2024-01-15T10:30:00Z")
function _toMs(t) {
    if (!t) return 0;
    if (typeof t === 'string') return new Date(t).getTime();
    return t < 1e12 ? t * 1000 : t;
}

// UTC start-of-today in ms
function _todayStart() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
}

// ── v3/v4 compatibility helpers ──────────────────────────────────────────────

// Returns the flat players array, handling both v3 (players.all_players) and v4 (players[])
function _playerList(m) {
    return m.players?.all_players || m.players || [];
}

// Returns rounds_played, handling both v3 (metadata.rounds_played) and v4 (rounds array length)
function _roundsPlayed(m) {
    return m.metadata?.rounds_played || (m.rounds || []).length || 0;
}

// Returns the match timestamp in ms, handling both v3 (game_start) and v4 (started_at)
function _matchTs(m) {
    return _toMs(m.metadata?.started_at || m.metadata?.game_start || 0);
}

// Returns the map name, handling both v3 (string or {name}) and v4 ({name})
function _mapName(m) {
    const raw = m.metadata?.map;
    if (!raw) return '?';
    if (typeof raw === 'string') return raw;
    return raw.name || '?';
}

// Returns the queue/mode string, handling both v3 (queue string) and v4 (queue.id object)
function _queueId(m) {
    const q = m.metadata?.queue;
    if (!q) return (m.metadata?.mode || '').toLowerCase();
    if (typeof q === 'string') return q.toLowerCase();
    return (q.id || '').toLowerCase();
}

// Returns win/score for a player's team, handling both v3 (teams object) and v4 (teams array)
function _teamResult(m, teamId) {
    const t = (teamId || '').toLowerCase();
    if (Array.isArray(m.teams)) {
        // v4: teams is an array
        const mine = m.teams.find(x => (x.team_id || '').toLowerCase() === t);
        const opp  = m.teams.find(x => (x.team_id || '').toLowerCase() !== t);
        return {
            won:      mine?.won === true,
            scoreUs:  mine?.rounds?.won ?? 0,
            scoreThem: opp?.rounds?.won ?? 0,
        };
    }
    // v3: teams is { red: {...}, blue: {...} }
    const opp = t === 'red' ? 'blue' : 'red';
    return {
        won:       m.teams?.[t]?.has_won === true,
        scoreUs:   m.teams?.[t]?.rounds_won ?? 0,
        scoreThem: m.teams?.[opp]?.rounds_won ?? 0,
    };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns today's match counts: { ranked, dm }
 * dm combines deathmatch + teamdeathmatch
 */
async function getTodayProgress(region, gameName, tagLine, apiKey) {
    const enc  = (s) => encodeURIComponent(s);
    const base = `v4/matches/${region}/pc/${enc(gameName)}/${enc(tagLine)}`;
    const key  = `today:${region}:${gameName}:${tagLine}`;

    return _cached(key, 10 * 60 * 1000, async () => {
        const today = _todayStart();

        // Sequential — concurrent requests land on the same Henrik backend node;
        // if that node is unhealthy they all fail together. Sequential spreads
        // them across nodes so at least some succeed.
        const wrap = (p) => p.then(v => ({ status: 'fulfilled', value: v }))
                             .catch(e => ({ status: 'rejected', reason: e }));
        const r   = await wrap(_get(`${base}?mode=competitive&size=10`,    apiKey));
        const dm  = await wrap(_get(`${base}?mode=deathmatch&size=10`,     apiKey));
        const tdm = await wrap(_get(`${base}?mode=teamdeathmatch&size=10`, apiKey));

        function countToday(res, minRounds = 0) {
            if (res.status !== 'fulfilled') return 0;
            return (res.value?.data || []).filter(m =>
                _matchTs(m) >= today &&
                _roundsPlayed(m) >= minRounds
            ).length;
        }

        return {
            ranked: countToday(r, 5),   // ≥5 rounds = real competitive, not a remake
            dm:     countToday(dm) + countToday(tdm),
        };
    });
}

/**
 * Returns aggregated ranked stats + raw match list (last `size` competitive matches).
 * Aggregated: { acs, kd, hsPercent, winRate, matches (array of simplified match objects) }
 */
async function getRankedStats(region, gameName, tagLine, apiKey, size = 10) {
    const enc  = (s) => encodeURIComponent(s);
    // v4 max size is 10
    const safeSize = Math.min(size, 10);
    const key  = `ranked:${region}:${gameName}:${tagLine}:${safeSize}`;

    return _cached(key, 15 * 60 * 1000, async () => {
        const res = await _get(
            `v4/matches/${region}/pc/${enc(gameName)}/${enc(tagLine)}?mode=competitive&size=${safeSize}`,
            apiKey
        );
        return _aggregateRanked(res.data || [], gameName, tagLine);
    });
}

/**
 * Returns training data: per-day DM/TDM counts for the last 7 days + avg stats.
 * { days: [{date, dm, tdm, total}], totals: {dm, tdm}, avgKills }
 */
async function getTrainingStats(region, gameName, tagLine, apiKey, size = 10) {
    const enc  = (s) => encodeURIComponent(s);
    // v4 max size is 10
    const safeSize = Math.min(size, 10);
    const key  = `training:${region}:${gameName}:${tagLine}:${safeSize}`;

    return _cached(key, 15 * 60 * 1000, async () => {
        // Sequential — concurrent requests land on the same Henrik backend node;
        // if that node is unhealthy they all fail together. Sequential spreads
        // them across nodes so at least some succeed.
        const wrap = (p) => p.then(v => ({ status: 'fulfilled', value: v }))
                             .catch(e => ({ status: 'rejected', reason: e }));
        const dm  = await wrap(_get(`v4/matches/${region}/pc/${enc(gameName)}/${enc(tagLine)}?mode=deathmatch&size=${safeSize}`,     apiKey));
        const tdm = await wrap(_get(`v4/matches/${region}/pc/${enc(gameName)}/${enc(tagLine)}?mode=teamdeathmatch&size=${safeSize}`, apiKey));

        // If both failed (e.g. rate limit), throw so the cache is not poisoned with empty data
        if (dm.status === 'rejected' && tdm.status === 'rejected') {
            throw dm.reason || new Error('Training data unavailable');
        }

        return _aggregateTraining(
            dm.status  === 'fulfilled' ? dm.value?.data  || [] : [],
            tdm.status === 'fulfilled' ? tdm.value?.data || [] : [],
            gameName,
            tagLine
        );
    });
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

function _findPlayer(players, gameName, tagLine) {
    return (players || []).find(p =>
        p.name?.toLowerCase() === gameName.toLowerCase() &&
        p.tag?.toLowerCase()  === tagLine.toLowerCase()
    );
}

function _aggregateRanked(matches, gameName, tagLine) {
    const simplified = [];
    let totalAcs = 0, totalKd = 0, totalHs = 0, wins = 0;

    for (const m of matches) {
        const rounds = _roundsPlayed(m);

        // Skip remakes and non-competitive entries slipping through the filter
        if (rounds < 5) continue;

        const p = _findPlayer(_playerList(m), gameName, tagLine);
        if (!p) continue;

        const s = p.stats || {};
        const acs   = Math.round((s.score || 0) / rounds);
        const kd    = parseFloat(((s.kills || 0) / Math.max(1, s.deaths || 1)).toFixed(2));
        const shots = (s.headshots || 0) + (s.bodyshots || 0) + (s.legshots || 0);
        const hs    = shots > 0 ? Math.round((s.headshots || 0) / shots * 100) : 0;

        const team   = (p.team_id || p.team || '').toLowerCase();
        const result = _teamResult(m, team);

        if (result.won) wins++;
        totalAcs += acs;
        totalKd  += kd;
        totalHs  += hs;

        // Agent: v4 uses p.agent.name, v3 uses p.character (string or object)
        const agent = p.agent?.name || (typeof p.character === 'string' ? p.character : p.character?.name) || '?';
        // Rank: v4 uses p.tier.name, v3 uses p.currenttier_patched
        const tier  = p.tier?.name || p.currenttier_patched || '';

        simplified.push({
            matchId:   m.metadata?.match_id || m.metadata?.matchid,
            date:      _matchTs(m),
            map:       _mapName(m),
            agent,
            acs,
            kills:     s.kills   || 0,
            deaths:    s.deaths  || 0,
            assists:   s.assists || 0,
            kd,
            hsPercent: hs,
            won:       result.won,
            tier,
            scoreUs:   result.scoreUs,
            scoreThem: result.scoreThem,
        });
    }

    const n = simplified.length || 1;
    return {
        count:      simplified.length,
        acs:        Math.round(totalAcs / n),
        kd:         parseFloat((totalKd  / n).toFixed(2)),
        hsPercent:  Math.round(totalHs   / n),
        winRate:    Math.round(wins / n * 100),
        matches:    simplified,
    };
}

function _aggregateTraining(dmMatches, tdmMatches, gameName, tagLine) {
    // Build a map: dateKey → { dm, tdm, kills }
    const dayMap = {};

    function addDay(m, queueType) {
        const ts = _matchTs(m);
        if (!ts) return;

        // Only count matches where this player actually appears
        const p = _findPlayer(_playerList(m), gameName, tagLine);
        if (!p) return;

        // Cross-check queue type via metadata (guards against API filter leaking wrong modes)
        const queue = _queueId(m);
        if (queueType === 'dm'  && !queue.includes('deathmatch'))     return;
        if (queueType === 'tdm' && !queue.includes('teamdeathmatch')) return;

        const d   = new Date(ts);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        if (!dayMap[key]) dayMap[key] = { date: key, dm: 0, tdm: 0, kills: 0 };

        const kills = p.stats?.kills || 0;
        if (queueType === 'dm')  { dayMap[key].dm++;  dayMap[key].kills += kills; }
        if (queueType === 'tdm') { dayMap[key].tdm++; dayMap[key].kills += kills; }
    }

    dmMatches.forEach(m  => addDay(m, 'dm'));
    tdmMatches.forEach(m => addDay(m, 'tdm'));

    // Last 7 days (fill gaps with 0)
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d   = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        d.setUTCHours(0, 0, 0, 0);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        days.push(dayMap[key] || { date: key, dm: 0, tdm: 0, kills: 0 });
    }

    const allGames = Object.values(dayMap);
    const totalGames = allGames.reduce((s, d) => s + d.dm + d.tdm, 0);
    const totalKills = allGames.reduce((s, d) => s + d.kills, 0);

    return {
        days,
        totals: {
            dm:  allGames.reduce((s, d) => s + d.dm,  0),
            tdm: allGames.reduce((s, d) => s + d.tdm, 0),
        },
        avgKills: totalGames > 0 ? Math.round(totalKills / totalGames) : 0,
    };
}

// Clears all cache entries for a specific player (region:gameName:tagLine)
function clearPlayerCache(region, gameName, tagLine) {
    const prefix = `:${region}:${gameName}:${tagLine}`;
    for (const key of _cache.keys()) {
        if (key.includes(prefix)) _cache.delete(key);
    }
}

/**
 * Diagnostic ping — tests 3 endpoints in sequence and returns timing + result for each.
 * Useful for debugging connectivity issues.
 * { status, account, match } — each has { ok, elapsed, error? }
 */
async function pingHenrik(apiKey, region, gameName, tagLine) {
    const enc = (s) => encodeURIComponent(s);

    async function probe(label, path, key) {
        const t0 = Date.now();
        try {
            const data = await _get(path, key);
            return { label, ok: true, elapsed: Date.now() - t0, hint: data?.status || data?.data?.[0]?.metadata?.match_id || '✓' };
        } catch (e) {
            return { label, ok: false, elapsed: Date.now() - t0, error: e.message };
        }
    }

    // Run sequentially so logs are readable and we can compare v3 vs v4
    const status   = await probe('v1/status (no key)',          `v1/status/${region}`, null);
    const account  = await probe('v1/account (with key)',       `v1/account/${enc(gameName)}/${enc(tagLine)}`, apiKey);
    const matchV4  = await probe('v4/match-history (with key)', `v4/matches/${region}/pc/${enc(gameName)}/${enc(tagLine)}?mode=competitive&size=1`, apiKey);
    const matchV3  = await probe('v3/match-history (with key)', `v3/matches/${region}/${enc(gameName)}/${enc(tagLine)}?filter=competitive&size=1`,   apiKey);

    return { apiKeySet: !!apiKey, region, gameName, tagLine, status, account, matchV4, matchV3 };
}

/**
 * Raw Henrik fetch — used by the sync service to get match data without processing.
 * path: e.g. 'v4/matches/br/pc/Name/Tag?mode=competitive&size=10'
 */
function fetchRaw(path, apiKey) {
    return _get(path, apiKey);
}

module.exports = { getTodayProgress, getRankedStats, getTrainingStats, clearPlayerCache, pingHenrik, fetchRaw };
