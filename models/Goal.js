const mongoose = require('mongoose');
const ObjId = mongoose.Schema.Types.ObjectId;

// A Goal is a fixed daily training target for a player (or all players on a team).
// No dates — goals are perpetual until changed by the manager.
// Players can self-adjust Ranked and DM targets within ±5 of the manager's base.
const goalSchema = new mongoose.Schema({
    teamId:   { type: ObjId, ref: 'Team', required: true },
    createdBy:{ type: ObjId, ref: 'User', required: true },

    // 'all' (string) = applies to every player without an individual goal
    // ObjectId string = individual override for that player
    playerId: { type: String, required: true },

    // Manager-set baselines
    minRanked:     { type: Number, default: 2, min: 0, max: 20 },
    minDM:         { type: Number, default: 3, min: 0, max: 20 }, // DM + TDM combined
    warmupMinutes: { type: Number, default: 30, min: 0, max: 120 },

    // Player personal adjustment (−5 to +5), updated via PATCH /adjust
    playerRankedAdjust: { type: Number, default: 0, min: -5, max: 5 },
    playerDMAdjust:     { type: Number, default: 0, min: -5, max: 5 },
}, { timestamps: true });

// One goal per (team, player) pair
goalSchema.index({ teamId: 1, playerId: 1 }, { unique: true });

module.exports = mongoose.model('Goal', goalSchema);
