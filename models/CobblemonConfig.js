const mongoose = require('mongoose');

const CobblemonConfigSchema = new mongoose.Schema({
    type:      { type: String, required: true, unique: true }, // 'league' | 'vip'
    data:      { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String },
});

module.exports = mongoose.model('CobblemonConfig', CobblemonConfigSchema);
