'use strict';
const axios    = require('axios');
const { parse } = require('node-html-parser');
const CompMatch = require('../models/CompMatch');
const CIRCUITS  = require('../config/comp-circuits');

const DELAY_MS        = 1500;                         // polite delay between requests
const FOUR_MONTHS_MS  = 4 * 30 * 24 * 60 * 60 * 1000;
const VLR_BASE        = 'https://www.vlr.gg';

let _syncRunning = false;
let _lastSyncAt  = null;

const _sleep = ms => new Promise(r => setTimeout(r, ms));

async function _get(url) {
    await _sleep(DELAY_MS);
    const r = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept':     'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 20000,
    });
    return r.data;
}

// ── Fetch completed match IDs for an event ────────────────────────────────────
async function fetchEventMatchIds(eventId) {
    const html = await _get(`${VLR_BASE}/event/matches/${eventId}?series_id=all`);
    const root = parse(html);
    const ids  = [];

    root.querySelectorAll('a.match-item').forEach(el => {
        // Only completed matches
        if (!el.querySelector('.ml.mod-completed')) return;
        const href = el.getAttribute('href') || '';
        const m    = href.match(/^\/(\d+)\//);
        if (m) ids.push(m[1]);
    });

    return ids;
}

// ── Parse agent picks from a match page ───────────────────────────────────────
async function fetchMatchDetails(matchId) {
    const html = await _get(`${VLR_BASE}/${matchId}`);
    const root = parse(html);
    const maps = [];

    root.querySelectorAll('div.vm-stats-game').forEach(gameEl => {
        const gameId = gameEl.getAttribute('data-game-id');
        if (!gameId || gameId === 'all') return; // skip aggregate tab

        // ── Map name ──────────────────────────────────────────────────────────
        // div.map > div > span — grab only the direct text, strip "PICK"/"BAN" child spans
        const mapDiv  = gameEl.querySelector('div.map');
        const mapSpan = mapDiv?.querySelector('span');
        // Remove child spans (PICK/BAN labels) and grab remaining text
        const mapName = mapSpan
            ? mapSpan.childNodes
                .filter(n => n.nodeType === 3) // text nodes only
                .map(n => n.text.trim())
                .join('').trim() || 'Unknown'
            : 'Unknown';

        // ── Per-map team names and winner ─────────────────────────────────────
        const header    = gameEl.querySelector('div.vm-stats-game-header');
        const teamEls   = header ? header.querySelectorAll('.team') : [];
        const team1Name = teamEls[0]?.querySelector('.team-name')?.text.trim() || '';
        const team2Name = teamEls[1]?.querySelector('.team-name')?.text.trim() || '';
        const team1Won  = !!teamEls[0]?.querySelector('.score.mod-win');

        // ── Agent picks ───────────────────────────────────────────────────────
        // First <tbody> = team1 players, second = team2 players
        const tbodies = gameEl.querySelectorAll('tbody');

        const extractAgents = (tbody) => {
            if (!tbody) return [];
            return tbody.querySelectorAll('tr').map(row => {
                const img = row.querySelector('span.stats-sq.mod-agent img');
                return img ? (img.getAttribute('title') || img.getAttribute('alt') || '') : '';
            }).filter(Boolean);
        };

        const team1Agents = extractAgents(tbodies[0]);
        const team2Agents = extractAgents(tbodies[1]);

        if (team1Agents.length || team2Agents.length) {
            maps.push({ mapName, team1Name, team2Name, team1Won, team1Agents, team2Agents });
        }
    });

    const team1Name = maps[0]?.team1Name || '';
    const team2Name = maps[0]?.team2Name || '';

    return { team1Name, team2Name, maps };
}

// ── Sync a single circuit ─────────────────────────────────────────────────────
async function syncCircuit(circuit) {
    let added = 0, skipped = 0, errors = 0;

    for (const eventId of circuit.eventIds) {
        let matchIds = [];
        try {
            matchIds = await fetchEventMatchIds(eventId);
            console.log(`[compSync] ${circuit.name} event ${eventId}: ${matchIds.length} completed matches found`);
        } catch (e) {
            console.error(`[compSync] event ${eventId} list error:`, e.message);
            errors++;
            continue;
        }

        for (const matchId of matchIds) {
            try {
                const exists = await CompMatch.exists({ vlrMatchId: matchId });
                if (exists) { skipped++; continue; }

                const details = await fetchMatchDetails(matchId);
                if (!details.maps.length) {
                    console.warn(`[compSync] match ${matchId}: no map data, skipping`);
                    skipped++;
                    continue;
                }

                const now = new Date();
                await CompMatch.create({
                    vlrMatchId: matchId,
                    vlrEventId: String(eventId),
                    circuit:    circuit.name,
                    team1Name:  details.team1Name,
                    team2Name:  details.team2Name,
                    date:       now,
                    expiresAt:  new Date(now.getTime() + FOUR_MONTHS_MS),
                    maps:       details.maps,
                });
                added++;
                console.log(`[compSync] saved match ${matchId}: ${details.team1Name} vs ${details.team2Name} (${details.maps.length} maps)`);
            } catch (e) {
                // Duplicate key = already exists (race), skip silently
                if (e.code === 11000) { skipped++; continue; }
                console.error(`[compSync] match ${matchId} error:`, e.message);
                errors++;
            }
        }
    }

    return { added, skipped, errors };
}

// ── Full sync across all circuits ─────────────────────────────────────────────
async function syncAll() {
    if (_syncRunning) {
        console.warn('[compSync] sync already running, skipping');
        return null;
    }
    _syncRunning = true;
    const started = Date.now();
    console.log('[compSync] ── starting full sync ──');

    const results = {};
    for (const circuit of CIRCUITS) {
        try {
            results[circuit.name] = await syncCircuit(circuit);
            const r = results[circuit.name];
            console.log(`[compSync] ${circuit.name}: +${r.added} new, ${r.skipped} skipped, ${r.errors} errors`);
        } catch (e) {
            console.error(`[compSync] circuit "${circuit.name}" fatal:`, e.message);
            results[circuit.name] = { added: 0, skipped: 0, errors: 1 };
        }
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    _lastSyncAt   = new Date();
    _syncRunning  = false;
    console.log(`[compSync] ── sync complete in ${elapsed}s ──`);
    return { results, duration: elapsed, completedAt: _lastSyncAt };
}

function getSyncStatus() {
    return { running: _syncRunning, lastSyncAt: _lastSyncAt };
}

module.exports = { syncAll, syncCircuit, fetchEventMatchIds, fetchMatchDetails, getSyncStatus };
