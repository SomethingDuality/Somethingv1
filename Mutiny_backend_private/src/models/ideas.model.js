const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
	title:  { type: String, required: true, maxlength: 120 },
	status: { type: String, enum: ['open', 'done'], default: 'open' },
	doneAt: { type: Date, default: null },
	proof:  { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

const attachmentSchema = new mongoose.Schema({
	name: { type: String, required: true },
	size: { type: String },
	type: {
		type: String,
		enum: ['presentation', 'video', 'audio', 'document'],
		default: 'document'
	},
	url: { type: String }   
}, { _id: false });

const ideaSchema = new mongoose.Schema({
	founder_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Founder',
		required: true
	},

	author: {
		type: String,
		default: 'Anonymous'
	},

	title: {
		type: String,
		required: true,
		trim: true
	},

	description: {
		type: String,
		required: true
	},

	desc: {
		type: String
	},

	tags: [{ type: String }],

	// Optional: posting an idea needs only a title and a description. The Something box asks
	// for the stage later (just in time, before investor matching).
	stage: {
		type: String,
		enum: ['concept', 'prototype', 'mvp', 'launched', '', null],
	},

	lookingFor: [{ type: String }],

	// How much the founder is raising, as a raisingBands id ("not_raising" is an answer too).
	raising: { type: String, default: '' },

	isDraft: {
		type: Boolean,
		default: false
	},

	attachments: [attachmentSchema],

	// What the founder will show progress on; investors record releases against done ones.
	milestones: { type: [milestoneSchema], default: [] },

	likes:    { type: Number, default: 0 },
	views:    { type: Number, default: 0 },
	comments: { type: Number, default: 0 },

	pptURL: { type: String },
	pow:    { type: String },

	// Where each user-set value came from (see profile/applyUpdate.js).
	fieldSources: { type: Map, of: new mongoose.Schema({ source: String, at: Date }, { _id: false }), default: undefined }

}, { timestamps: true });

// Hot queries: a founder's ideas (newest first) and the public discover/feed lists.
ideaSchema.index({ founder_id: 1, createdAt: -1 });
ideaSchema.index({ isDraft: 1, createdAt: -1 });

const Idea = mongoose.model('Idea', ideaSchema);

module.exports = { Idea };
