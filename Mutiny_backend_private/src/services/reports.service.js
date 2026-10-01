// Reports and admin decisions on community content (C1).
// - One report per person per item; repeats are a quiet no-op.
// - Enough reports hide the item (ideas 5, comments and problems 3) until an admin looks; approved items
//   are immune. Hiding and every admin decision tell the author, and keep counters right.

const mongoose = require('mongoose');
const { Report, REPORT_REASONS } = require('../models/report.model.js');
const { ModerationAction } = require('../models/moderationAction.model.js');
const { Idea } = require('../models/ideas.model.js');
const { BaseUser } = require('../models/user.model.js');
const { Problem } = require('../models/problem.model.js');
const { TARGETS, isShown, sameId, placeOf, linkFor } = require('../community/targets.js');
const { pushNotification } = require('./notifications.service.js');
const cache = require('../utils/cache.js');

class ReportError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

const targetFor = (type) => {
	const t = TARGETS[type];
	if (!t) throw new ReportError(400, 'type must be idea, comment, problem or message');
	return t;
};

// Side effects of a state change: counters, caches and a word to the author.
const onStateChange = async (type, doc, from, to) => {
	const t = TARGETS[type];
	const place = await placeOf(type, doc);
	const delta = Number(isShown({ state: to })) - Number(isShown({ state: from }));
	if (type === 'comment') {
		// The parent's count only includes comments people can see.
		if (delta && place.kind === 'problem') await Problem.updateOne({ _id: place.id }, { $inc: { commentsCount: delta } });
		if (delta && place.kind === 'idea') await Idea.updateOne({ _id: place.id }, { $inc: { comments: delta } });
		if (place.kind === 'idea') await cache.del(`comments:v1:${place.id}`);
	}
	if (type === 'idea') await cache.del(`user_ideas:${doc.founder_id}`);

	const owner = doc[t.owner];
	if (!owner) return;
	const author = await BaseUser.findById(owner).select('role').lean();
	const what = t.label(doc, place);
	const text =
		to === 'hidden'  ? `${what[0].toUpperCase()}${what.slice(1)} is hidden while we look at some reports. Only you can see it for now.`
		: to === 'removed' ? `${what[0].toUpperCase()}${what.slice(1)} was removed because it breaks the community rules.`
		: from === 'hidden' || from === 'removed' ? `${what[0].toUpperCase()}${what.slice(1)} is visible again.`
		: null;
	if (!text) return;
	await pushNotification(owner, text, { link: author ? linkFor(place, author.role) : undefined });
};

const createReport = async ({ reporterId, type, id, reason, note }) => {
	const t = targetFor(type);
	if (!mongoose.Types.ObjectId.isValid(id)) throw new ReportError(400, 'Invalid ID');
	if (!REPORT_REASONS.includes(reason)) throw new ReportError(400, `reason must be one of: ${REPORT_REASONS.join(', ')}`);
	const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) : '';

	const doc = await t.model().findById(id).select(t.select).lean();
	// Only what the reporter can actually see can be reported.
	if (!doc || !isShown(doc.moderation) || !(await t.isPublic(doc, reporterId))) throw new ReportError(404, 'Not found');
	if (sameId(doc[t.owner], reporterId)) throw new ReportError(400, "You can't report your own post");

	let inserted;
	try {
		const r = await Report.updateOne(
			{ targetType: type, targetId: id, reporterId },
			{ $setOnInsert: { reason, note: cleanNote, snapshot: t.snapshot(doc).slice(0, 1000) } },
			{ upsert: true },
		);
		inserted = r.upsertedCount === 1;
	} catch (err) {
		if (err?.code === 11000) inserted = false; // a parallel duplicate
		else throw err;
	}
	if (!inserted) return { alreadyReported: true, hidden: false };

	await t.model().updateOne({ _id: id }, { $inc: { 'moderation.reportCount': 1 } });
	// Conditional, so only one of several parallel reports flips it (and notifies once).
	const hide = await t.model().updateOne(
		{ _id: id, 'moderation.reportCount': { $gte: t.threshold }, 'moderation.state': { $nin: ['approved', 'hidden', 'removed'] } },
		{ $set: { 'moderation.state': 'hidden', 'moderation.hiddenAt': new Date() } },
	);
	const hidden = hide.modifiedCount === 1;
	if (hidden) await onStateChange(type, doc, doc.moderation?.state || 'visible', 'hidden');
	return { alreadyReported: false, hidden };
};

const ACTION_STATE = { restore: 'visible', approve: 'approved', remove: 'removed' };

const applyAction = async ({ adminId, type, id, action, note }) => {
	const t = targetFor(type);
	if (!mongoose.Types.ObjectId.isValid(id)) throw new ReportError(400, 'Invalid ID');
	const to = ACTION_STATE[action];
	if (!to) throw new ReportError(400, 'action must be restore, approve or remove');

	const doc = await t.model().findById(id).select(t.select).lean();
	if (!doc) throw new ReportError(404, 'Not found');
	const from = doc.moderation?.state || 'visible';

	const set = { 'moderation.state': to, 'moderation.needsReview': false, 'moderation.reviewedAt': new Date() };
	// A restored item starts counting again; approved items keep their history but are immune.
	if (action === 'restore') set['moderation.reportCount'] = 0;
	await t.model().updateOne({ _id: id }, { $set: set });
	await ModerationAction.create({
		adminId, targetType: type, targetId: id, action, from, to,
		note: typeof note === 'string' ? note.trim().slice(0, 300) : '',
	});
	if (from !== to) await onStateChange(type, doc, from, to);
	return { state: to };
};

const VIEWS = {
	hidden:   { 'moderation.state': 'hidden' },
	reported: { 'moderation.reportCount': { $gt: 0 }, 'moderation.state': { $nin: ['hidden', 'removed', 'approved'] } },
	review:   { 'moderation.needsReview': true, 'moderation.state': { $nin: ['removed'] } },
};

/** The admin queue: hidden items, reported items still up, and items the word filter flagged. */
const listQueue = async (view) => {
	const filter = VIEWS[view] || VIEWS.hidden;
	const found = await Promise.all(Object.entries(TARGETS).map(async ([type, t]) =>
		(await t.model().find(filter).select(t.select).sort({ updatedAt: -1 }).limit(100).lean())
			.map((doc) => ({ type, doc }))));
	const all = found.flat();
	if (!all.length) return [];

	const ids = all.map(({ doc }) => doc._id);
	const [reports, authors, places] = await Promise.all([
		Report.find({ targetId: { $in: ids } }).select('targetId reason note createdAt').sort({ createdAt: -1 }).lean(),
		BaseUser.find({ _id: { $in: all.map(({ type, doc }) => doc[TARGETS[type].owner]) } }).select('name').lean(),
		Promise.all(all.map(({ type, doc }) => placeOf(type, doc))),
	]);
	const nameOf = new Map(authors.map((a) => [String(a._id), a.name || '']));
	const byTarget = new Map();
	for (const r of reports) {
		const k = String(r.targetId);
		if (!byTarget.has(k)) byTarget.set(k, { reasons: {}, notes: [] });
		const e = byTarget.get(k);
		e.reasons[r.reason] = (e.reasons[r.reason] || 0) + 1;
		if (r.note && e.notes.length < 3) e.notes.push(r.note);
	}

	return all
		.map(({ type, doc }, i) => {
			const t = TARGETS[type];
			const rep = byTarget.get(String(doc._id)) || { reasons: {}, notes: [] };
			return {
				type,
				id:           doc._id,
				// Where it lives: an idea page, or the problems board opened on that problem.
				place:        { kind: places[i].kind, id: places[i].id, title: places[i].title || '' },
				text:         t.snapshot(doc).slice(0, 600),
				// Admins see who wrote it, even when it was posted without a name.
				author:       nameOf.get(String(doc[t.owner])) || 'Deleted account',
				anonymous:    Boolean(doc.anonymous),
				state:        doc.moderation?.state || 'visible',
				reportCount:  doc.moderation?.reportCount || 0,
				needsReview:  Boolean(doc.moderation?.needsReview),
				flaggedTerms: doc.moderation?.flaggedTerms || [],
				reasons:      rep.reasons,
				notes:        rep.notes,
				createdAt:    doc.createdAt,
			};
		})
		.sort((a, b) => b.reportCount - a.reportCount || new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Account deletion: the person's reports go, and the counts they added come back off.
 * (Content written by the person is removed by the caller.)
 */
const forgetReporter = async (reporterId) => {
	const mine = await Report.find({ reporterId }).select('targetType targetId').lean();
	for (const type of Object.keys(TARGETS)) {
		const ids = mine.filter((r) => r.targetType === type).map((r) => r.targetId);
		if (ids.length) {
			await TARGETS[type].model().updateMany(
				{ _id: { $in: ids }, 'moderation.reportCount': { $gt: 0 } },
				{ $inc: { 'moderation.reportCount': -1 } },
			);
		}
	}
	await Report.deleteMany({ reporterId });
};

module.exports = { createReport, applyAction, listQueue, forgetReporter, ReportError, REPORT_REASONS };
