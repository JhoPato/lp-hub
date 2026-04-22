const mongoose = require('mongoose');

const siteNewsSchema = new mongoose.Schema({
    title:          { type: String, required: true, maxlength: 300 },
    content:        { type: String, default: '' },
    image:          { type: String, default: '' },   
    video_id:       { type: String, default: '' },   
    status:         { type: String, enum: ['draft', 'pending_review', 'published', 'rejected'], default: 'draft' },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName:  { type: String, default: '' },
    reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote:     { type: String, default: '' },    
    publishedId:    { type: String, default: null },  
    publishedAt:    { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SiteNews', siteNewsSchema);
