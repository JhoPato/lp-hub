const mongoose = require('mongoose');

// Stores a player's linked Discord + Minecraft identity
const CobblemonPlayerSchema = new mongoose.Schema({
    // Discord identity (from OAuth)
    discordId:       { type: String, required: true, unique: true },
    discordUsername: { type: String, required: true },
    discordAvatar:   { type: String, default: '' },    // Discord CDN avatar hash

    // Minecraft identity (set by player after login)
    minecraftUsername: { type: String, default: '' },
    minecraftUUID:     { type: String, default: '' },  // Mojang UUID (with dashes)

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('CobblemonPlayer', CobblemonPlayerSchema);
