require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const https     = require('https');
const http      = require('http');
const jwt       = require('jsonwebtoken');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { createSession, getSession, deleteSession } = require('./services/boardSessions');

const app    = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : null;
const corsOptions = {
    origin: allowedOrigins
        ? (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) cb(null, true);
            else cb(new Error('Not allowed by CORS'));
        }
        : '*',
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
};

const io = new Server(server, { cors: { origin: allowedOrigins || '*' }, pingTimeout: 90000, pingInterval: 30000 });

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '8mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
const frontendDir = fs.existsSync(path.join(__dirname, '_pub')) ? '_pub' : 'frontend';
app.use(express.static(path.join(__dirname, frontendDir)));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/invites',       require('./routes/invites'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/schedule',      require('./routes/schedule'));
app.use('/api/pracc',         require('./routes/pracc'));
app.use('/api/auth',          require('./routes/profile')); 
app.use('/api/profile',       require('./routes/profile')); 
app.use('/api/team',          require('./routes/team'));
app.use('/api/gallery',       require('./routes/gallery'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/site',          require('./routes/publicSite'));
app.use('/api/strategy',      require('./routes/strategy'));
app.use('/api/goals',         require('./routes/goals'));
app.use('/api/henrik',        require('./routes/henrik'));
app.use('/api/board-session', require('./routes/boardSession'));
app.use('/api/cobblemon',    require('./routes/cobblemon'));
app.use('/api/cobblemon',    require('./routes/cobblemonAuth'));
app.use('/api/ai-chat',      require('./routes/aiChat'));
app.use('/api/comps',        require('./routes/comps'));
app.use('/api/auth',         require('./routes/discord'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.get('/api/vapi-proxy', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url param' });
    const allowed = ['media.valorant-api.com', 'valorant-api.com'];
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid url' }); }
    if (!allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
        return res.status(403).json({ error: 'Domain not allowed' });
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const request = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (upstream) => {
        res.set('Content-Type', upstream.headers['content-type'] || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        upstream.pipe(res);
    });
    request.on('error', () => res.status(502).json({ error: 'Proxy fetch failed' }));
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' });
    res.sendFile(path.join(__dirname, frontendDir, 'login.html'));
});

app.use((err, req, res, next) => {
    console.error('[LP-Hub Error]', err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Server error.' });
});

// ── Socket.io — Board Sessions ────────────────────────────────────────────────
const USER_COLORS = ['#df5840','#57f287','#fee75c','#5865f2','#eb459e','#00b0f4','#ff6b35','#9b59b6'];

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try { socket.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
    catch { next(new Error('Unauthorized')); }
});

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('session:join', ({ roomCode }) => {
        const session = getSession(roomCode);
        if (!session) { socket.emit('session:error', 'Session not found or expired.'); return; }

        currentRoom = roomCode;
        const usedColors = [...session.participants.values()].map(p => p.color);
        const color = USER_COLORS.find(c => !usedColors.includes(c)) || USER_COLORS[session.participants.size % USER_COLORS.length];
        const participant = { userId: socket.user.userId, username: socket.user.username, color, socketId: socket.id };
        session.participants.set(socket.id, participant);
        socket.join(roomCode);

        socket.emit('session:state', {
            state: session.state,
            participants: [...session.participants.values()],
            isHost: session.hostUserId === socket.user.userId,
            roomCode,
        });
        socket.to(roomCode).emit('user:joined', participant);
    });

    socket.on('el:add', (data) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        session.state.objects.push(data);
        socket.to(currentRoom).emit('el:add', data);
    });

    socket.on('el:delete', ({ id }) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        session.state.objects = session.state.objects.filter(o => o._id !== id);
        socket.to(currentRoom).emit('el:delete', { id });
    });

    socket.on('el:move', ({ id, x, y, dragging }) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        if (!dragging) { const obj = session.state.objects.find(o => o._id === id); if (obj) { obj.x = x; obj.y = y; } }
        socket.to(currentRoom).emit('el:move', { id, x, y, dragging, socketId: socket.id });
    });

    socket.on('el:update', ({ dragging, ...data }) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        if (!dragging) {
            const idx = session.state.objects.findIndex(o => o._id === data._id);
            if (idx !== -1) session.state.objects[idx] = data;
        }
        socket.to(currentRoom).emit('el:update', { ...data, dragging });
    });

    socket.on('agent:select', ({ agentUuid }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit('agent:select', { socketId: socket.id, agentUuid });
    });

    socket.on('side:change', ({ side }) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        session.state.side = side;
        socket.to(currentRoom).emit('side:change', { side });
    });

    socket.on('map:change', ({ mapUuid }) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        session.state.mapUuid = mapUuid;
        session.state.objects = [];
        socket.to(currentRoom).emit('map:change', { mapUuid });
    });

    socket.on('board:init', ({ mapUuid, side, objects }) => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session || session.hostUserId !== socket.user.userId) return;
        session.state.mapUuid = mapUuid;
        session.state.side = side || 'atk';
        session.state.objects = objects || [];
        socket.to(currentRoom).emit('session:state', {
            state: session.state,
            participants: [...session.participants.values()],
            isHost: false,
        });
    });

    socket.on('board:clear', () => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        session.state.objects = [];
        socket.to(currentRoom).emit('board:clear');
    });

    socket.on('cursor:move', ({ x, y }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit('cursor:move', { socketId: socket.id, x, y });
    });

    socket.on('preview:move', ({ x, y, type, agentUuid, slot }) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit('preview:move', { socketId: socket.id, x, y, type, agentUuid, slot });
    });

    socket.on('preview:remove', () => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit('preview:remove', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
        if (!currentRoom) return;
        const session = getSession(currentRoom);
        if (!session) return;
        session.participants.delete(socket.id);
        io.to(currentRoom).emit('user:left', { socketId: socket.id });
    });
});
// ─────────────────────────────────────────────────────────────────────────────

const PORT      = process.env.PORT || 8080;
const matchSync = require('./services/matchSync');
const cron      = require('node-cron');
const compSync  = require('./services/compSync');

connectDB().then(() => {
    server.listen(PORT, () => console.log(`[LP-Hub] Running on port ${PORT}`));
    matchSync.startScheduler();

    // ── Comp DB: daily sync at 03:00 ─────────────────────────────────────────
    cron.schedule('0 3 * * *', () => {
        console.log('[compSync] daily cron triggered');
        compSync.syncAll().catch(e => console.error('[compSync] cron error:', e.message));
    });
    // Run once on startup (catches any matches added since last server run)
    setTimeout(() => {
        console.log('[compSync] startup sync');
        compSync.syncAll().catch(e => console.error('[compSync] startup error:', e.message));
    }, 5000); // 5s delay so DB connection is settled
});
