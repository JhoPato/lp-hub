'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const mapResultSchema = new Schema({
    mapName:     { type: String },
    team1Name:   { type: String },
    team2Name:   { type: String },
    team1Agents: [String],
    team2Agents: [String],
    team1Won:    { type: Boolean },
}, { _id: false });

const compMatchSchema = new Schema({
    vlrMatchId: { type: String, required: true, unique: true },
    vlrEventId: { type: String, required: true },
    circuit:    { type: String, required: true },
    team1Name:  { type: String, default: '' },
    team2Name:  { type: String, default: '' },
    date:       { type: Date, default: Date.now },
    // MongoDB TTL index: document is auto-deleted when expiresAt is reached
    expiresAt:  { type: Date, required: true },
    maps:       [mapResultSchema],
});

// TTL — auto-purge after 4 months
compMatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Query patterns
compMatchSchema.index({ circuit: 1, date: -1 });
compMatchSchema.index({ team1Name: 1 });
compMatchSchema.index({ team2Name: 1 });
compMatchSchema.index({ 'maps.mapName': 1 });

module.exports = mongoose.model('CompMatch', compMatchSchema);
