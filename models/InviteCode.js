const mongoose = require('mongoose');
const crypto   = require('crypto');

const inviteCodeSchema = new mongoose.Schema({
    code:      { type: String, required: true, unique: true },
    teamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }, 
    role:      { type: String, enum: ['player', 'captain', 'manager', 'social', 'owner'], required: true },
    siteTeam:  {
        region:    { type: String, default: null },
        teamIndex: { type: Number, default: null },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    usedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usedAt:    { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    isUsed:    { type: Boolean, default: false },
}, { timestamps: true });

inviteCodeSchema.statics.generate = () =>
    crypto.randomBytes(4).toString('hex').toUpperCase();

module.exports = mongoose.model('InviteCode', inviteCodeSchema);
