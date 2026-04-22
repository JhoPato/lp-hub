const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    teamId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    isPinned: { type: Boolean, default: false },
}, { timestamps: true });

announcementSchema.index({ teamId: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
