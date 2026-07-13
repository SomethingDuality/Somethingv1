const mongoose = require('mongoose');

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

	stage: {
		type: String,
		enum: ['concept', 'prototype', 'mvp', 'launched'],
		required: true
	},

	lookingFor: [{ type: String }],

	isDraft: {
		type: Boolean,
		default: false
	},

	attachments: [attachmentSchema],

	likes:    { type: Number, default: 0 },
	views:    { type: Number, default: 0 },
	comments: { type: Number, default: 0 },

	pptURL: { type: String },
	pow:    { type: String }

}, { timestamps: true });

const Idea = mongoose.model('Idea', ideaSchema);

module.exports = { Idea };
