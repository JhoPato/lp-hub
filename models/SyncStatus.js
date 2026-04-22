'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Tracks the last sync attempt per player-account-type combination.
// Used to show "last updated X ago" on the UI and to detect stale data.
const syncStatusSchema = new Schema({
    teamId:          { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    account:         { type: Number, enum: [1, 2], default: 1 },
    type:            { type: String, enum: ['ranked', 'training'], required: true },
    lastSyncAt:      { type: Date,   default: null },
    lastStatus:      { type: String, enum: ['ok', 'error', 'no_data', 'pending'], default: 'pending' },
    newMatchesSaved: { type: Number, default: 0 },
});

syncStatusSchema.index(
    { teamId: 1, userId: 1, account: 1, type: 1 },
    { unique: true }
);

module.exports = mongoose.model('SyncStatus', syncStatusSchema);
