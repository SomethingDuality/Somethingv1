const mongoose = require('mongoose');

// Moderation state on anything the community can post (ideas and comments today; problems and
// chat messages later). A missing subdocument means "visible", so old rows need no backfill.
//   visible:  shown normally
//   hidden:   enough reports came in; only the author sees it, with a banner, until an admin looks
//   removed:  an admin took it down
//   approved: an admin checked it; further reports no longer hide it
const moderationSchema = new mongoose.Schema({
	state:        { type: String, enum: ['visible', 'hidden', 'removed', 'approved'], default: 'visible' },
	reportCount:  { type: Number, default: 0, min: 0 },
	// The word filter matched a "review" term: posted, and waiting in the admin queue.
	needsReview:  { type: Boolean, default: false },
	flaggedTerms: { type: [String], default: undefined },
	hiddenAt:     { type: Date },
	reviewedAt:   { type: Date },
}, { _id: false });

const HIDDEN_STATES = ['hidden', 'removed'];

module.exports = { moderationSchema, HIDDEN_STATES };
