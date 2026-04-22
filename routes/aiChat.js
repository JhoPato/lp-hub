const express    = require('express');
const router     = express.Router();
const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const CompMatch  = require('../models/CompMatch');
const { authMiddleware } = require('../middleware/auth');

const COACH_CONTEXT_PATH = path.join(__dirname, '../config/coach-context.md');

// Public — just tactical game knowledge, not user data
router.get('/coach-context', (req, res) => {
    try {
        const content = fs.readFileSync(COACH_CONTEXT_PATH, 'utf8');
        res.type('text/plain').send(content);
    } catch {
        res.status(404).send('');
    }
});

router.use(authMiddleware);

// ── Auto-save helpers ─────────────────────────────────────────────────────────
const AUTO_START    = key => `<!-- AUTO:START | section: "${key}"`;
const AUTO_END      = '<!-- AUTO:END -->';
const AUTO_MIN_DAYS = 30;  // don't overwrite an insight newer than this
const AUTO_MAX      = 40;  // max auto-saved blocks in the file

function _countAutoBlocks(text) {
    let n = 0, i = 0;
    while ((i = text.indexOf('<!-- AUTO:START', i)) !== -1) { n++; i++; }
    return n;
}

function _mergeInsight(fileContent, key, heading, insight, source) {
    const today    = new Date().toISOString().slice(0, 10);
    const startTag = AUTO_START(key);
    const block    = `${startTag} | updated: ${today} | source: ${source} -->\n### ${heading}\n${insight}\n${AUTO_END}`;

    const si = fileContent.indexOf(startTag);

    if (si !== -1) {
        // Block exists — check age before overwriting
        const headerLine = fileContent.slice(si, fileContent.indexOf('\n', si));
        const dm         = headerLine.match(/updated: (\d{4}-\d{2}-\d{2})/);
        if (dm) {
            const ageDays = (Date.now() - new Date(dm[1]).getTime()) / 86_400_000;
            if (ageDays < AUTO_MIN_DAYS) {
                return {
                    saved:  false,
                    reason: `"${key}" atualizado há ${Math.floor(ageDays)}d — próxima atualização em ${Math.ceil(AUTO_MIN_DAYS - ageDays)}d.`,
                };
            }
        }
        const ei = fileContent.indexOf(AUTO_END, si) + AUTO_END.length;
        return { saved: true, content: fileContent.slice(0, si) + block + fileContent.slice(ei) };
    }

    // New key — check cap
    if (_countAutoBlocks(fileContent) >= AUTO_MAX) {
        return { saved: false, reason: 'Limite de 40 insights atingido. Consolide entradas antigas antes de adicionar novas.' };
    }
    // Append before end of file
    return { saved: true, content: fileContent.trimEnd() + '\n\n' + block + '\n' };
}

const TOOLS = [
    {
        name: 'place_agent',
        description: 'Place an agent token on the board. Use the map landmarks provided in the system prompt for accurate positioning.',
        input_schema: {
            type: 'object',
            properties: {
                agentName: { type: 'string', description: 'Agent display name exactly as listed in Available Agents, e.g. "Jett", "Sova"' },
                x: { type: 'number', description: 'Horizontal position 0–1 relative to map bounds (use landmarks for reference)' },
                y: { type: 'number', description: 'Vertical position 0–1 relative to map bounds (use landmarks for reference)' },
            },
            required: ['agentName', 'x', 'y'],
        },
    },
    {
        name: 'place_ability',
        description: 'Place an ability icon for an agent already on the board. The agent must already be placed via place_agent first.',
        input_schema: {
            type: 'object',
            properties: {
                agentName: { type: 'string', description: 'Agent display name, e.g. "Sova"' },
                slot:      { type: 'string', enum: ['hab1','hab2','hab3','ult'], description: 'Ability slot: hab1=Ability1, hab2=Ability2, hab3=Grenade slot, ult=Ultimate. Use the slot listed in the system prompt for each agent.' },
                x: { type: 'number', description: 'Horizontal position 0–1' },
                y: { type: 'number', description: 'Vertical position 0–1' },
                angle: { type: 'number', description: 'Rotation angle in degrees (0 = right, 90 = down). Default 0.' },
            },
            required: ['agentName', 'slot', 'x', 'y'],
        },
    },
    {
        name: 'draw_arrow',
        description: 'Draw an arrow on the board to indicate movement routes, rotations, or attack directions.',
        input_schema: {
            type: 'object',
            properties: {
                x1: { type: 'number', description: 'Start X 0–1' },
                y1: { type: 'number', description: 'Start Y 0–1' },
                x2: { type: 'number', description: 'End X 0–1' },
                y2: { type: 'number', description: 'End Y 0–1' },
                color: { type: 'string', description: 'Hex color, e.g. "#df5840" for red, "#22c55e" for green, "#4a9eff" for blue, "#ffffff" for white. Default "#df5840".' },
                label: { type: 'string', description: 'Optional short text label to place at the arrow midpoint, e.g. "rotate", "entry"' },
            },
            required: ['x1','y1','x2','y2'],
        },
    },
    {
        name: 'place_text',
        description: 'Place a text label on the board to annotate areas, callouts, or instructions.',
        input_schema: {
            type: 'object',
            properties: {
                text:  { type: 'string', description: 'The text content to display' },
                x:     { type: 'number', description: 'Position X 0–1' },
                y:     { type: 'number', description: 'Position Y 0–1' },
                color: { type: 'string', description: 'Hex color. Default "#ffffff".' },
            },
            required: ['text','x','y'],
        },
    },
    {
        name: 'clear_board',
        description: 'Remove all agents, abilities and drawings from the board. Use only when explicitly asked.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'save_coaching_insight',
        description: `Persist a high-value tactical insight to the permanent coach knowledge base (coach-context.md).

ONLY call this tool when the insight is derived from one of these sources:
  • board_strategy — patterns, timings, or compositions observed on the current board
  • uploaded_doc   — explicit content from a document the user uploaded
  • comp_data      — win-rate patterns or team compositions returned by query_comps

NEVER call this for:
  • General game knowledge already in the static context
  • Speculative suggestions not backed by data
  • Simple answers to user questions

Blocks with the same key are automatically replaced when older than 30 days.
Write specific, verifiable insights — agent names, sites, timings, win rates. Max 400 chars per insight.`,
        input_schema: {
            type: 'object',
            properties: {
                key:     { type: 'string', description: 'Unique snake_case topic ID, e.g. "ascent_atk_exec_a_main". Reusing a key updates the existing entry.' },
                heading: { type: 'string', description: 'Short display title, e.g. "Ascent — Exec A Main padrão"' },
                insight: { type: 'string', description: 'Tactical insight in markdown. Specific: agents, positions, timings, win rates. Max 400 chars.' },
                source:  { type: 'string', enum: ['board_strategy', 'uploaded_doc', 'comp_data'] },
            },
            required: ['key', 'heading', 'insight', 'source'],
        },
    },
    {
        name: 'capture_board',
        description: `Capture the current strategy board as an image for visual analysis.
Call this when you need to:
- Inspect exact positions of agents, abilities, arrows or text on the map
- Reference specific areas, callouts or coordinate points
- Verify spatial relationships between board elements
- Answer questions about what is currently placed on the board

Do NOT call if the question is purely conceptual/tactical with no spatial component, or if you have already captured in the current turn.`,
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'query_comps',
        description: 'Search the pro match database for agent compositions used by top teams. Use this when the user asks about what professionals play, team compositions, or wants references from pro matches. Always query before suggesting comp changes.',
        input_schema: {
            type: 'object',
            properties: {
                circuit: { type: 'string', description: 'Tournament circuit filter, e.g. "VCT Americas", "Masters", "Champions", "VCL Brazil". Leave empty for all circuits.' },
                map:     { type: 'string', description: 'Map name filter, e.g. "Ascent", "Bind", "Haven". Leave empty for all maps.' },
                team:    { type: 'string', description: 'Team name filter, e.g. "LOUD", "Sentinels", "NaVi". Leave empty for all teams.' },
                limit:   { type: 'number', description: 'Max results to return (default 10, max 30).' },
            },
            required: [],
        },
    },
];

function anthropicRequest(payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const options = {
            hostname: 'api.anthropic.com',
            path:     '/v1/messages',
            method:   'POST',
            headers: {
                'Content-Type':      'application/json',
                'x-api-key':         process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-beta':    'prompt-caching-2024-07-31',
                'Content-Length':    Buffer.byteLength(body),
            },
        };
        const req = https.request(options, res => {
            let raw = '';
            res.on('data', chunk => { raw += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
                catch { reject(new Error('Invalid JSON from Anthropic')); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── Shared agentic loop ───────────────────────────────────────────────────────
// Runs until stop or capture_board tool is encountered (which needs client-side execution).
// Returns { finalText, allToolCalls } on normal finish
//      or { captureRequest: { tool_use_id, assistantContent, serverResults, conversationState }, finalText, allToolCalls }
async function runAgenticLoop({ builtSystem, resolvedModel, resolvedTokens, messages }) {
    const MAX_ROUNDS  = 6;
    let   loopMsgs    = [...messages];
    let   allToolCalls = [];
    let   finalText    = '';

    for (let round = 0; round < MAX_ROUNDS; round++) {
        const r = await anthropicRequest({
            model:      resolvedModel,
            max_tokens: resolvedTokens,
            system:     builtSystem,
            tools:      TOOLS,
            messages:   loopMsgs,
        });

        if (r.status !== 200) throw new Error(r.data.error?.message || 'Anthropic error');

        const resp       = r.data;
        const toolBlocks = (resp.content || []).filter(b => b.type === 'tool_use');
        const roundText  = (resp.content || []).find(b => b.type === 'text')?.text || '';
        if (roundText) finalText = roundText;

        if (!toolBlocks.length || resp.stop_reason !== 'tool_use') break;

        // Split: capture_board must be handled client-side; all others run here
        const captureBlock = toolBlocks.find(b => b.name === 'capture_board');
        const serverBlocks = toolBlocks.filter(b => b.name !== 'capture_board');

        const serverResults = await Promise.all(serverBlocks.map(executeTool));
        allToolCalls.push(...serverBlocks.map(b => ({ name: b.name, input: b.input })));

        if (captureBlock) {
            // Pause loop — client needs to provide the board image
            return {
                captureRequest: {
                    tool_use_id:       captureBlock.id,
                    assistantContent:  resp.content,
                    serverResults,
                    conversationState: loopMsgs,
                },
                finalText,
                allToolCalls,
            };
        }

        loopMsgs = [
            ...loopMsgs,
            { role: 'assistant', content: resp.content },
            { role: 'user',      content: serverResults },
        ];
    }

    return { finalText, allToolCalls };
}

// Build system array for Anthropic: static part (cached) + dynamic part (board context)
function buildSystem(systemStatic, systemDynamic) {
    // If only a plain string was sent (legacy), use it as-is
    if (!systemStatic && !systemDynamic) return '';
    const blocks = [];
    if (systemStatic) {
        blocks.push({ type: 'text', text: systemStatic, cache_control: { type: 'ephemeral' } });
    }
    if (systemDynamic) {
        blocks.push({ type: 'text', text: systemDynamic });
    }
    return blocks;
}

// Execute a single tool call and return the tool_result block
async function executeTool(b) {
    let content = 'Executed successfully on the board.';

    if (b.name === 'query_comps') {
        try {
            const inp = b.input || {};
            const filter = {};
            if (inp.circuit) filter.circuit          = { $regex: inp.circuit, $options: 'i' };
            if (inp.map)     filter['maps.mapName']  = { $regex: inp.map,     $options: 'i' };
            if (inp.team)    filter.$or = [
                { team1Name: { $regex: inp.team, $options: 'i' } },
                { team2Name: { $regex: inp.team, $options: 'i' } },
            ];
            const limit   = Math.min(parseInt(inp.limit) || 10, 30);
            const matches = await CompMatch.find(filter).sort({ date: -1 }).limit(limit).lean();

            if (!matches.length) {
                content = 'No pro matches found for the given filters. The database may not have data for this circuit/map/team yet.';
            } else {
                const lines = matches.map(m => {
                    const mapLines = (inp.map
                        ? m.maps.filter(mp => mp.mapName?.toLowerCase().includes(inp.map.toLowerCase()))
                        : m.maps
                    ).map(mp => {
                        const winner = mp.team1Won ? mp.team1Name : mp.team2Name;
                        return `  • ${mp.mapName}: ${mp.team1Name} [${mp.team1Agents.join(', ')}] vs ${mp.team2Name} [${mp.team2Agents.join(', ')}] — winner: ${winner}`;
                    });
                    return `[${m.circuit}] ${m.team1Name} vs ${m.team2Name} (${new Date(m.date).toISOString().slice(0,10)})\n${mapLines.join('\n')}`;
                });
                content = `Found ${matches.length} match(es):\n\n${lines.join('\n\n')}`;
            }
        } catch (e) {
            content = `Database query error: ${e.message}`;
        }
    }

    if (b.name === 'save_coaching_insight') {
        try {
            const { key, heading, insight, source } = b.input || {};
            if (!key || !heading || !insight || !source) {
                content = 'Erro: key, heading, insight e source são obrigatórios.';
            } else if (insight.length > 400) {
                content = `Insight muito longo (${insight.length} chars). Reduza para max 400 chars e tente novamente.`;
            } else {
                const fileContent = fs.readFileSync(COACH_CONTEXT_PATH, 'utf8');
                const result      = _mergeInsight(fileContent, key, heading, insight, source);
                if (result.saved) {
                    fs.writeFileSync(COACH_CONTEXT_PATH, result.content, 'utf8');
                    content = `✓ Insight "${key}" salvo na base de conhecimento (source: ${source}).`;
                } else {
                    content = `Não salvo: ${result.reason}`;
                }
            }
        } catch (e) {
            content = `Erro ao salvar insight: ${e.message}`;
        }
    }

    return { type: 'tool_result', tool_use_id: b.id, content };
}

router.post('/', async (req, res) => {
    const { system, systemStatic, systemDynamic, messages, model, max_tokens } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }
    if (!Array.isArray(messages) || !messages.length) {
        return res.status(400).json({ error: 'messages required' });
    }

    try {
        const builtSystem  = buildSystem(systemStatic, systemDynamic) || system || '';
        const resolvedModel = model      || 'claude-haiku-4-5-20251001';
        const resolvedTokens = max_tokens || 2048;

        // ── Agentic loop: keep going until the model stops calling tools ──────
        const result = await runAgenticLoop({ builtSystem, resolvedModel, resolvedTokens, messages });
        if (result.captureRequest) {
            return res.json(result); // client must capture board and call /continue
        }
        res.json({ text: result.finalText, toolCalls: result.allToolCalls });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/ai-chat/continue ────────────────────────────────────────────────
// Called by the client after capturing the board image in response to a captureRequest.
// Resumes the agentic loop with the image injected as the capture_board tool result.
router.post('/continue', async (req, res) => {
    const { tool_use_id, assistantContent, serverResults, conversationState,
            imageB64, systemStatic, systemDynamic, model, max_tokens } = req.body;

    if (!tool_use_id || !assistantContent || !conversationState) {
        return res.status(400).json({ error: 'tool_use_id, assistantContent and conversationState required' });
    }

    try {
        const builtSystem    = buildSystem(systemStatic, systemDynamic) || '';
        const resolvedModel  = model      || 'claude-haiku-4-5-20251001';
        const resolvedTokens = max_tokens || 2048;

        // Build capture tool result — image if provided, fallback to text
        const captureResult = {
            type:        'tool_result',
            tool_use_id,
            content: imageB64
                ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } }]
                : [{ type: 'text', text: 'Board capture unavailable.' }],
        };

        // Reconstruct conversation at the point after the capture tool round
        const resumeMsgs = [
            ...conversationState,
            { role: 'assistant', content: assistantContent },
            { role: 'user',      content: [...(serverResults || []), captureResult] },
        ];

        const result = await runAgenticLoop({ builtSystem, resolvedModel, resolvedTokens, messages: resumeMsgs });

        // Nested capture requests are not supported — just return what we have
        res.json({ text: result.finalText, toolCalls: result.allToolCalls });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
