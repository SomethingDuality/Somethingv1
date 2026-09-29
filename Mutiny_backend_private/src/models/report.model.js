const mongoose = require('mongoose');

const REPORT_REASONS = ['spam', 'harassment', 'scam', 'off_topic', 'personal_info', 'other'];

// One report per person per item (the unique index makes repeats a no-op). `snapshot` keeps
// what the item said when it was reported, in case it is edited afterwards.
const reportSchema = new mongoose.Schema({
	targetType: { type: String, enum: ['idea', 'comment', 'problem', 'message'], required: true },
	targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
	reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	reason:     { type: String, enum: REPORT_REASONS, required: true },
	note:       { type: String, default: '', maxlength: 500 },
	snapshot:   { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });

reportSchema.index({ targetType: 1, targetId: 1, reporterId: 1 }, { unique: true });
reportSchema.index({ reporterId: 1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = { Report, REPORT_REASONS };
