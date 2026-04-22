const mongoose = require('mongoose');

const scheduleEventSchema = new mongoose.Schema({
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['pracc', 'tournament', 'warmup', 'other'], required: true },
    title:       { type: String, required: true, trim: true },
    notes:       { type: String, default: '' },
    startTime:   { type: String, required: true },
    endTime:     { type: String, required: true },
    isRecurring: { type: Boolean, default: false },
    dates:       [{ type: Date }],
    recurDays:   [{ type: Number }],
    recurUntil:  { type: Date, default: null },
    opponent:    { type: String, default: '' },
    streamUrl:   { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ScheduleEvent', scheduleEventSchema);
