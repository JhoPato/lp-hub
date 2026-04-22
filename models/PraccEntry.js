const mongoose = require('mongoose');

const mapSchema = new mongoose.Schema({
    mapName:    { type: String, required: true },
    result:     { type: String, enum: ['win','loss','draw'], required: true },
    scoreUs:    { type: Number, default: 0 },
    scoreThem:  { type: Number, default: 0 },
}, { _id: false });

const screenshotSchema = new mongoose.Schema({
    url:       { type: String, required: true },
    publicId:  { type: String, required: true },
    caption:   { type: String, default: '' },
});

const praccSchema = new mongoose.Schema({
    teamId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date:          { type: Date, required: true },
    opponent:      { type: String, required: true },
    maps:          { type: [mapSchema], default: [] },
    overallResult: { type: String, enum: ['win','loss','draw'], required: true },
    notes:         { type: String, default: '' },
    vodUrl:        {
        type: String,
        default: '',
        validate: {
            validator: function(v) {
                if (!v) return true;
                return /youtube\.com|youtu\.be/.test(v);
            },
            message: 'Invalid YouTube URL. Must be a youtube.com or youtu.be link.',
        }
    },
    screenshots:   { type: [screenshotSchema], default: [] },
}, { timestamps: true });

praccSchema.methods.getYouTubeId = function() {
    if (!this.vodUrl) return null;
    const m = this.vodUrl.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
};

module.exports = mongoose.model('PraccEntry', praccSchema);
