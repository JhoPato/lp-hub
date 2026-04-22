'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Stores one processed match per document — minimal data (Option B).
// Ranked: matchId + playedAt + won
// Training (DM/TDM): matchId + playedAt + type
const matchSnapshotSchema = new Schema({
    teamId:   { type: Schema.Types.ObjectId, ref: 'Team',  required: true },
    userId:   { type: Schema.Types.ObjectId, ref: 'User',  required: true },
    account:  { type: Number, enum: [1, 2],  default: 1   }, // 1 = primary, 2 = secondary Riot account
    matchId:  { type: String, required: true },
    type:     { type: String, enum: ['ranked', 'dm', 'tdm'], required: true },
    playedAt: { type: Date,   required: true },
    won:      { type: Boolean, default: null }, // ranked only; null for DM/TDM
    syncedAt: { type: Date,   default: Date.now },
});

// Prevent duplicate entries for the same match
matchSnapshotSchema.index(
    { teamId: 1, userId: 1, account: 1, matchId: 1, type: 1 },
    { unique: true }
);
// Fast range queries (last-7-days training, last-N ranked)
matchSnapshotSchema.index({ userId: 1, type: 1, playedAt: -1 });

module.exports = mongoose.model('MatchSnapshot', matchSnapshotSchema);
