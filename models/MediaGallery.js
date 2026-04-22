const mongoose = require('mongoose');

const mediaGallerySchema = new mongoose.Schema({
    teamId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    uploadedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:               { type: String, enum: ['photo', 'screenshot'], default: 'photo' },
    url:                { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    caption:            { type: String, default: '' },
    linkedPraccId:      { type: mongoose.Schema.Types.ObjectId, ref: 'PraccEntry', default: null },
    isAdminUpload:      { type: Boolean, default: false },
    adminSection:       { type: String, enum: ['players', 'managers', null], default: null },
}, { timestamps: true });

mediaGallerySchema.index({ teamId: 1, createdAt: -1 });

module.exports = mongoose.model('MediaGallery', mediaGallerySchema);
