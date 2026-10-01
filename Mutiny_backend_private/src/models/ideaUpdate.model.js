const mongoose = require('mongoose');

// A short update a founder posts on one of their ideas ("first 10 canteens signed").
// Investors who saved or committed to the idea are told; deleted with the idea (ideaPurge).
const ideaUpdateSchema = new mongoose.Schema({
	idea_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true },
	founder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Founder', required: true },
	text:       { type: String, required: true, maxlength: 1000 },
}, { timestamps: true });

ideaUpdateSchema.index({ idea_id: 1, createdAt: -1 });

const IdeaUpdate = mongoose.model('IdeaUpdate', ideaUpdateSchema);

module.exports = { IdeaUpdate };
