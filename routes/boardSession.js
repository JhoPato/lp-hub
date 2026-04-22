const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createSession, getSession } = require('../services/boardSessions');

router.use(authMiddleware);

router.post('/', (req, res) => {
    const { userId, username } = req.user;
    const roomCode = createSession({ hostUserId: userId, hostUsername: username });
    res.json({ roomCode });
});

router.get('/:code', (req, res) => {
    const session = getSession(req.params.code);
    if (!session) return res.status(404).json({ error: 'Session not found or expired.' });
    res.json({ roomCode: session.roomCode, participantCount: session.participants.size });
});

module.exports = router;
