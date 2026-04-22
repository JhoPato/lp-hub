const mongoose = require('mongoose');

const RoundPlayerStatSchema = new mongoose.Schema({
    subject:      String,
    kills:        { type: Number, default: 0 },
    damage:       { type: Number, default: 0 },
    headshots:    { type: Number, default: 0 },
    bodyshots:    { type: Number, default: 0 },
    legshots:     { type: Number, default: 0 },
    score:        { type: Number, default: 0 },
    survived:     { type: Boolean, default: false },
    loadoutValue: { type: Number, default: 0 },
    weaponId:     { type: String, default: '' },
    armorId:      { type: String, default: '' },
    spent:        { type: Number, default: 0 },
    remaining:    { type: Number, default: 0 },
    abilityCasts: {
        grenade:  { type: Boolean, default: false },
        ability1: { type: Boolean, default: false },
        ability2: { type: Boolean, default: false },
        ultimate: { type: Boolean, default: false },
    },
}, { _id: false });

const RoundResultSchema = new mongoose.Schema({
    roundNum:            Number,
    result:              String,   
    winnerTeam:          String,   
    winnerRole:          String,   
    ourTeamWon:          Boolean,
    plantSite:           { type: String, default: null },
    plantRoundTime:      { type: Number, default: 0 },
    defuseRoundTime:     { type: Number, default: 0 },
    firstKillerSubject:  { type: String, default: null },
    firstVictimSubject:  { type: String, default: null },
    playerStats:         [RoundPlayerStatSchema],
}, { _id: false });

const KillLocationSchema = new mongoose.Schema({
    subject:     String,
    viewRadians: { type: Number, default: 0 },
    location:    { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
}, { _id: false });

const KillEventSchema = new mongoose.Schema({
    roundNum:           Number,
    roundTime:          Number,
    killer:             String,
    victim:             String,
    assistants:         [String],
    weaponId:           { type: String, default: '' },
    isFirstKillOfRound: { type: Boolean, default: false },
    playerLocations:    { type: [KillLocationSchema], default: [] },
}, { _id: false });

const PlayerMatchStatSchema = new mongoose.Schema({
    subject:           String,
    gameName:          String,
    tagLine:           String,
    isOurTeam:         Boolean,
    characterId:       { type: String, default: '' },
    hubPlayerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    kills:             { type: Number, default: 0 },
    deaths:            { type: Number, default: 0 },
    assists:           { type: Number, default: 0 },
    score:             { type: Number, default: 0 },
    roundsPlayed:      { type: Number, default: 0 },

    acs:               { type: Number, default: 0 },   
    kd:                { type: Number, default: 0 },
    kda:               { type: Number, default: 0 },
    damagePerRound:    { type: Number, default: 0 },
    headshotPercent:   { type: Number, default: 0 },
    kastPercent:       { type: Number, default: 0 },

    firstKills:        { type: Number, default: 0 },
    firstDeaths:       { type: Number, default: 0 },

    totalDamage:       { type: Number, default: 0 },
    headshotCount:     { type: Number, default: 0 },
    bodyshotCount:     { type: Number, default: 0 },
    legshotCount:      { type: Number, default: 0 },

    mk2:               { type: Number, default: 0 },
    mk3:               { type: Number, default: 0 },
    mk4:               { type: Number, default: 0 },
    mk5:               { type: Number, default: 0 },

    clutchesAttempted: { type: Number, default: 0 },
    clutchesWon:       { type: Number, default: 0 },

    avgLoadoutValue:   { type: Number, default: 0 },

    grenadeCasts:      { type: Number, default: 0 },
    ability1Casts:     { type: Number, default: 0 },
    ability2Casts:     { type: Number, default: 0 },
    ultimateCasts:     { type: Number, default: 0 },
}, { _id: false });

const PraccMatchSchema = new mongoose.Schema({
    teamId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    matchId:          { type: String, required: true },
    mapId:            { type: String, default: '' },
    mapName:          { type: String, default: null },
    gameVersion:      { type: String, default: '' },
    gameStartMillis:  { type: Number, default: 0 },
    gameLengthMillis: { type: Number, default: 0 },
    date:             { type: Date },

    ourTeamColor:  { type: String, enum: ['Red', 'Blue'] },
    result:        { type: String, enum: ['W', 'L', 'D'] },
    scoreUs:       { type: Number, default: 0 },
    scoreThem:     { type: Number, default: 0 },
    opponent:      { type: String, default: '' },

    ourAttackRoundsWon:    { type: Number, default: 0 },
    ourAttackRoundsPlayed: { type: Number, default: 0 },
    ourDefenseRoundsWon:   { type: Number, default: 0 },
    ourDefenseRoundsPlayed:{ type: Number, default: 0 },

    players: [PlayerMatchStatSchema],
    rounds:  [RoundResultSchema],
    kills:   [KillEventSchema],

    vodUrl: { type: String, default: '' },
    vodNotes: [{
        title:     { type: String, default: '' },
        note:      { type: String, default: '' },
        timestamp: { type: Number, default: 0 }, 
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
    }],

    comments: [{
        authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, default: '' },
        text:       { type: String, required: true, maxlength: 500 },
        createdAt:  { type: Date, default: Date.now },
    }],

}, { timestamps: true });

PraccMatchSchema.index({ teamId: 1, date: -1 });
PraccMatchSchema.index({ teamId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model('PraccMatch', PraccMatchSchema);
