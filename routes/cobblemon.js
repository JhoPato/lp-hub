const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const { authMiddleware, requireRole } = require('../middleware/auth');
const CobblemonConfig = require('../models/CobblemonConfig');

const LP_API_URL   = process.env.LP_API_URL   || 'https://applostpuppies.discloud.app';
const LP_API_TOKEN = process.env.LPAPI_OWNER_TOKEN || '';

// ── Default data (mirrors LP-Cobblemon JSON files) ──────────────────────────

const DEFAULT_LEAGUE = {
    name: 'LP Cobblemon League',
    season: 1,
    logo: '',
    status: 'em_breve',
    statusLabel: 'COMING SOON',
    startDate: 'Data a confirmar',
    format: 'VGC · Best of 3 · Swiss',
    description: 'A primeira liga competitiva de Cobblemon organizada pela Lost Puppies Esports.',
    rules: [
        { id: 'formato',  icon: '⚔️',  title: 'Formato VGC',            content: 'Batalhas em duplas (Doubles). Cada jogador seleciona 6 Pokémon e traz 4 para a batalha. Máximo de 2 Pokémon Lendários restritos permitidos por equipa.' },
        { id: 'bo3',      icon: '🏆',  title: 'Best of 3 (Bo3)',         content: 'Cada confronto é disputado em até 3 jogos. O primeiro a vencer 2 jogos avança. A equipa pode ser alterada entre os jogos do mesmo confronto.' },
        { id: 'banlist',  icon: '🚫',  title: 'Banlist',                 content: 'Segue a Banlist oficial VGC Season 1 do servidor LP Cobblemon. Pokémon banidos serão anunciados antes do início. Uso de Pokémon banido resulta em desqualificação automática.' },
        { id: 'timer',    icon: '⏱️',  title: 'Tempo por Jogo',          content: 'Cada jogo tem duração máxima de 20 minutos. Em empate por tempo, vence quem tiver maior HP total nos Pokémon em campo no momento do fim.' },
        { id: 'registro', icon: '📋',  title: 'Requisitos de Inscrição', content: 'Ser membro do Discord oficial Lost Puppies. Ter acesso ao servidor Cobblemon LP. Cumprir o código de conduta. Vagas limitadas — por ordem de chegada.' },
        { id: 'lp-rules', icon: '🐾',  title: 'Regras LP',               content: 'Proibido uso de exploits, bugs ou glitches. Comportamento tóxico resulta em desqualificação imediata. A decisão do árbitro LP é sempre final em casos de disputa.' },
    ],
    registration: {
        status: 'coming_soon',
        maxParticipants: 16,
        currentParticipants: 0,
        discordLink: 'https://discord.gg/lostpuppies',
        formLink: '',
    },
    rounds: [],
    standings: [],
};

const DEFAULT_VIP = {
    tiers: [
        { id: 'iron',    name: 'Iron',    color: '#d8d8d8', price: '€ 2,50', period: '/ month', stripeLink: '', badge: '⚙️', featured: false, perks: ['[Iron] tag on the server', 'Access to exclusive Cobblemon areas', '1 guaranteed Shiny Pokémon per season', 'Early access to events', 'Priority support on Discord'] },
        { id: 'gold',    name: 'Gold',    color: '#ffaa00', price: '€ 5,00', period: '/ month', stripeLink: '', badge: '⭐', featured: true,  perks: ['Everything from Iron', '[Gold] tag on the server', '3 guaranteed Shiny Pokémon per season', 'Exclusive VIP Pokémon per season', 'Exclusive moves for your starter', 'VIP channel on Discord', 'Exclusive VIP tournaments'] },
        { id: 'diamond', name: 'Diamond', color: '#55ffff', price: '€ 8,25', period: '/ month', stripeLink: '', badge: '💎', featured: false, perks: ['Everything from Gold', '[Diamond] tag on the server', '1 guaranteed Legendary Pokémon per season', 'Custom coloured nickname', 'Personal rare Pokémon spawns', 'Access to the test server', 'Vote on league game design decisions'] },
    ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getConfig(type, defaultData) {
    let doc = await CobblemonConfig.findOne({ type });
    if (!doc) {
        doc = await CobblemonConfig.create({ type, data: defaultData });
    }
    return doc.data;
}

async function syncToLpApi(action, data) {
    if (!LP_API_TOKEN) return;
    try {
        await axios.post(`${LP_API_URL}/api/manage-cobblemon`, { token: LP_API_TOKEN, action, data });
    } catch (err) {
        console.warn('[Cobblemon] LP-API sync failed:', err.message);
    }
}

// ── Public GET (LP-Cobblemon site now reads from LP-API directly) ────────────

router.get('/league', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const data = await getConfig('league', DEFAULT_LEAGUE);
        res.json(data);
    } catch (err) {
        console.error('[Cobblemon] GET /league', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/vip', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const data = await getConfig('vip', DEFAULT_VIP);
        res.json(data);
    } catch (err) {
        console.error('[Cobblemon] GET /vip', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── Protected PUT (owner or social) ─────────────────────────────────────────

router.put('/league', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.userId).select('username').lean();

        const doc = await CobblemonConfig.findOneAndUpdate(
            { type: 'league' },
            { data: req.body, updatedAt: new Date(), updatedBy: user?.username || req.user.userId },
            { upsert: true, new: true }
        );

        // Sync to LP-API so cobblemon.lostpuppies.org reads updated data
        syncToLpApi('save-league', req.body);

        res.json({ ok: true, data: doc.data });
    } catch (err) {
        console.error('[Cobblemon] PUT /league', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.put('/vip', authMiddleware, requireRole('social', 'owner'), async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.userId).select('username').lean();

        const doc = await CobblemonConfig.findOneAndUpdate(
            { type: 'vip' },
            { data: req.body, updatedAt: new Date(), updatedBy: user?.username || req.user.userId },
            { upsert: true, new: true }
        );

        // Sync to LP-API so cobblemon.lostpuppies.org reads updated data
        syncToLpApi('save-vip', req.body);

        res.json({ ok: true, data: doc.data });
    } catch (err) {
        console.error('[Cobblemon] PUT /vip', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
