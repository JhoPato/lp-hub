const mongoose = require('mongoose');

// Stores a player's registration for a specific tournament season
const CobblemonRegistrationSchema = new mongoose.Schema({
    discordId: { type: String, required: true },
    season:    { type: Number, required: true },

    // Snapshot of player info at time of registration (for display)
    discordUsername:   { type: String, default: '' },
    discordAvatar:     { type: String, default: '' },
    minecraftUsername: { type: String, default: '' },
    minecraftUUID:     { type: String, default: '' },

    status: {
        type: String,
        enum: ['registered', 'confirmed', 'disqualified', 'withdrawn'],
        default: 'registered'
    },

    registeredAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One registration per player per season
CobblemonRegistrationSchema.index({ discordId: 1, season: 1 }, { unique: true });

module.exports = mongoose.model('CobblemonRegistration', CobblemonRegistrationSchema);
