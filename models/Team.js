const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name:                { type: String, required: true },
    tag:                 { type: String, required: true },
    game:                { type: String, default: 'Valorant' },
    region:              { type: String, required: true },
    logoUrl:             { type: String, default: '' },
    cloudinaryPublicId:  { type: String, default: '' },
    managerId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    apiPanelCode:        { type: String, default: null },
    apiPanelTeamName:    { type: String, default: null },
    icsToken:            { type: String, default: null },
    logos: {
        main:      { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
        whiteBg:   { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
        blackBg:   { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
        coloredBg: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    },
    lpApiTeam: {
        region:    { type: String, default: null },
        teamIndex: { type: Number, default: null },
    },
    websiteRoster: {
        players:    { type: Array, default: [] },
        coaches:    { type: Array, default: [] },
        lastSynced: { type: Date, default: null },
    },
    henrikApiKey:         { type: String,  default: null  },
    multiRegionEnabled:   { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
