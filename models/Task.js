const mongoose = require('mongoose');
const ObjId = mongoose.Schema.Types.ObjectId;

const commentSchema = new mongoose.Schema({
    authorId:   { type: ObjId, ref: 'User', required: true },
    authorName: { type: String, default: '' },
    text:       { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
    teamId:    { type: ObjId, ref: 'Team', required: true },
    createdBy: { type: ObjId, ref: 'User', required: true },
    assignedTo: [{ type: ObjId, ref: 'User' }],
    title:       { type: String, required: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    category:    { type: String, enum: ['general','analysis','preparation','physical','vod_review'], default: 'general' },
    status:      { type: String, enum: ['pending','in_progress','completed'], default: 'pending' },
    priority:    { type: String, enum: ['low','medium','high'], default: 'medium' },
    dueDate:     { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: ObjId, ref: 'User', default: null },
    requiresUpload: { type: Boolean, default: false },

    vodType:        { type: String, enum: ['none','pracc','external'], default: 'none' },
    linkedPraccId:  { type: ObjId, ref: 'PraccMatch', default: null },
    externalVodUrl: { type: String, default: null },
    vodTimestamps:  [{
        seconds:    { type: Number, required: true },
        label:      { type: String, maxlength: 200, default: '' },
        note:       { type: String, maxlength: 500, default: '' },
        authorId:   { type: ObjId, ref: 'User' },
        authorName: { type: String, default: '' },
        createdAt:  { type: Date, default: Date.now },
    }],

    uploadedFiles: [{
        url:        { type: String, required: true },
        publicId:   { type: String, required: true },
        caption:    { type: String, default: '' },
        uploadedBy: { type: ObjId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
    }],
    comments: [commentSchema],
}, { timestamps: true });

taskSchema.index({ teamId: 1, status: 1 });
taskSchema.index({ teamId: 1, assignedTo: 1 });

module.exports = mongoose.model('Task', taskSchema);
