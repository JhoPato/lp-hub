const mongoose = require('mongoose');
const ObjId = mongoose.Schema.Types.ObjectId;

const strategySchema = new mongoose.Schema({
    teamId:    { type: ObjId, ref: 'Team', required: true },
    createdBy: { type: ObjId, ref: 'User', required: true },
    name:      { type: String, required: true, maxlength: 80 },
    map:       { type: String, required: true },
    side:      { type: String, enum: ['atk', 'def', 'both'], default: 'both' },
    objects:   { type: String, required: true },
}, { timestamps: true });

strategySchema.index({ teamId: 1, updatedAt: -1 });

module.exports = mongoose.model('Strategy', strategySchema);
