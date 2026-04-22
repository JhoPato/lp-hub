const express       = require('express');
const router        = express.Router();
const ScheduleEvent = require('../models/ScheduleEvent');
const { authMiddleware, requireRole, requireOwner } = require('../middleware/auth');

function expandEvent(ev, from, to) {
    const results = [];
    if (ev.isRecurring) {
        const ceiling = ev.recurUntil
            ? new Date(Math.min(to.getTime(), new Date(ev.recurUntil).getTime()))
            : to;
        const cur = new Date(from);
        cur.setHours(0, 0, 0, 0);
        while (cur <= ceiling) {
            if ((ev.recurDays || []).includes(cur.getDay())) {
                results.push({ ...ev, date: new Date(cur) });
            }
            cur.setDate(cur.getDate() + 1);
        }
    } else {
        for (const d of (ev.dates || [])) {
            const date = new Date(d);
            date.setHours(0, 0, 0, 0);
            if (date >= from && date <= to) {
                results.push({ ...ev, date });
            }
        }
    }
    return results;
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const from = req.query.from ? new Date(req.query.from) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
        const to   = req.query.to   ? new Date(req.query.to)   : new Date(Date.now() + 60 * 86400000);

        const events = await ScheduleEvent.find({ teamId: req.user.teamId })
            .populate('createdBy', 'username')
            .lean();

        const expanded = events.flatMap(ev => expandEvent(ev, from, to));
        expanded.sort((a, b) => {
            const dateDiff = a.date - b.date;
            if (dateDiff !== 0) return dateDiff;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        res.json(expanded);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/', authMiddleware, requireRole('captain', 'manager'), async (req, res) => {
    try {
        const { type, title, notes, startTime, endTime, isRecurring, dates, recurDays, recurUntil, opponent, streamUrl } = req.body;

        if (!type || !['pracc', 'tournament', 'warmup', 'other'].includes(type))
            return res.status(400).json({ error: 'Valid type required.' });
        if (!title || !startTime || !endTime)
            return res.status(400).json({ error: 'title, startTime and endTime are required.' });

        const ev = await ScheduleEvent.create({
            teamId:      req.user.teamId,
            createdBy:   req.user.userId,
            type, title, notes: notes || '',
            startTime, endTime,
            isRecurring: !!isRecurring,
            dates:       !isRecurring ? (dates || []) : [],
            recurDays:   isRecurring  ? (recurDays || []) : [],
            recurUntil:  isRecurring && recurUntil ? new Date(recurUntil) : null,
            opponent:    ['pracc', 'tournament'].includes(type) ? (opponent  || '') : '',
            streamUrl:   type === 'tournament'  ? (streamUrl || '') : '',
        });

        res.status(201).json(ev);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id', authMiddleware, requireRole('manager'), async (req, res) => {
    try {
        const ev = await ScheduleEvent.findOneAndDelete({ _id: req.params.id, teamId: req.user.teamId });
        if (!ev) return res.status(404).json({ error: 'Not found.' });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/pracc', authMiddleware, requireOwner, async (req, res) => {
    try {
        const from   = req.query.from   ? new Date(req.query.from)   : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
        const to     = req.query.to     ? new Date(req.query.to)     : new Date(Date.now() + 60 * 86400000);
        const filter = { type: 'pracc' };
        if (req.query.teamId) filter.teamId = req.query.teamId;

        const events = await ScheduleEvent.find(filter)
            .populate('createdBy', 'username')
            .populate('teamId', 'name tag')
            .lean();

        const expanded = events.flatMap(ev => expandEvent(ev, from, to));
        expanded.sort((a, b) => a.date - b.date);
        res.json(expanded);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/tournament', authMiddleware, requireRole('social'), async (req, res) => {
    try {
        const from   = req.query.from   ? new Date(req.query.from)   : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
        const to     = req.query.to     ? new Date(req.query.to)     : new Date(Date.now() + 60 * 86400000);
        const filter = { type: 'tournament' };
        if (req.query.teamId) filter.teamId = req.query.teamId;

        const events = await ScheduleEvent.find(filter)
            .populate('createdBy', 'username')
            .populate('teamId', 'name tag region logoUrl logos')
            .lean();

        const expanded = events.flatMap(ev => expandEvent(ev, from, to));
        expanded.sort((a, b) => a.date - b.date);
        res.json(expanded);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
