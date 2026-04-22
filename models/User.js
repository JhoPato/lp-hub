const mongoose = require('mongoose');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
    username:           { type: String, required: true },
    email:              { type: String, required: true, unique: true, lowercase: true },
    passwordHash:       { type: String, required: true },
    role:               { type: String, enum: ['player', 'captain', 'manager', 'social', 'owner'], default: 'player' },
    siteTeam:           {
        region:    { type: String, default: null },
        teamIndex: { type: Number, default: null },
    },
    teamId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    teamIds:            { type: [mongoose.Schema.Types.ObjectId], ref: 'Team', default: [] },
    profilePhotoUrl:    { type: String, default: '' },
    cloudinaryPublicId: { type: String, default: '' },
    isActive:           { type: Boolean, default: true },
    apiPanelPlayerName: { type: String, default: null },
    riotGameName: { type: String, default: null },
    riotTagLine:  { type: String, default: null },
    riotRegion:   { type: String, enum: ['na','eu','ap','kr','latam','br'], default: null },
    riotGameName2: { type: String, default: null },
    riotTagLine2:  { type: String, default: null },
    riotRegion2:   { type: String, default: null },
    discordId:       { type: String, default: null, sparse: true },
    discordUsername: { type: String, default: null },
    discordAvatar:   { type: String, default: null },
}, { timestamps: true });

userSchema.statics.hashPassword = (password) =>
    crypto.createHash('sha256').update(password).digest('hex');

userSchema.methods.checkPassword = function(password) {
    return this.passwordHash === crypto.createHash('sha256').update(password).digest('hex');
};

module.exports = mongoose.model('User', userSchema);
