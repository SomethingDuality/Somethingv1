const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
	idea_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Idea',
		required: true
	},
	amount_committed: {
		type: Number,
		required: true,
		min: 0
	},
	amount_released: {
		type: Number,
		default: 0,
		min: 0
	},
	status: {
		type: String,
		enum: ['active', 'pending', 'released', 'withdrawn'],
		default: 'active'
	},
	committed_at: {
		type: Date,
		default: Date.now
	},
	// Each release recorded against this commitment (no money moves); a milestone when it was for one.
	releases: [{
		amount:       { type: Number, required: true, min: 0 },
		milestone_id: { type: mongoose.Schema.Types.ObjectId, default: null },
		at:           { type: Date, default: Date.now },
	}]
}, { _id: true });


investmentSchema.index({ idea_id: 1 });

const portfolioSchema = new mongoose.Schema({
	investor_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Investor',
		required: true,
		unique: true   
	},
	investments: [investmentSchema]
}, { timestamps: true });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = { Portfolio };
