const fs   = require('fs');
const path = require('path');
const { Idea }      = require('../models/ideas.model.js');
const { Like }      = require('../models/likes.model.js');
const { Comment }   = require('../models/comments.model.js');
const { IdeaUpdate } = require('../models/ideaUpdate.model.js');
const { Report }    = require('../models/report.model.js');
const { TeamInvite } = require('../models/teamInvite.model.js');
const { Team }      = require('../models/team.model.js');
const { Portfolio } = require('../models/portfolio.model.js');
const { BaseUser, Founder, Investor } = require('../models/user.model.js');
const { pushNotification } = require('./notifications.service.js');
const cache = require('../utils/cache.js');
const { purgeAgentForIdeas } = require('../agent/purge.js');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/ideas');

// Deletes ideas and everything hanging off them: likes, comments, updates, teams, investor commitments
// (each investor is told) and attachment files. This is what makes "we delete them when you
// ask" true (P16, X-46). Dependents go first and the ideas last, so a run that fails halfway
// can simply be retried: the ideas are still there to find.
// `ids` must already be validated ObjectIds (they become folder names below).
const purgeIdeas = async (ids) => {
	if (!ids.length) return;
	const ideas = await Idea.find({ _id: { $in: ids } }).select('title founder_id').lean();
	if (!ideas.length) return;
	const ideaIds = ideas.map((i) => i._id);
	const titleOf = new Map(ideas.map((i) => [String(i._id), i.title]));

	// What the agent stored about these ideas: memory notes, reviews, runs and checkpoints.
	await purgeAgentForIdeas(ideaIds);

	// Reports about the ideas or their comments go too: the content they point at is gone.
	const commentIds = (await Comment.find({ postID: { $in: ideaIds } }).select('_id').lean()).map((c) => c._id);
	await Promise.all([
		Like.deleteMany({ postID: { $in: ideaIds } }),
		Report.deleteMany({ $or: [
			{ targetType: 'idea', targetId: { $in: ideaIds } },
			{ targetType: 'comment', targetId: { $in: commentIds } },
		] }),
		IdeaUpdate.deleteMany({ idea_id: { $in: ideaIds } }),
		TeamInvite.deleteMany({ ideaId: { $in: ideaIds } }),
	]);
	await Comment.deleteMany({ postID: { $in: ideaIds } });
	await cache.del(...ideaIds.map((id) => `comments:v1:${id}`));

	const teams = await Team.find({ idea_id: { $in: ideaIds } }).select('_id').lean();
	if (teams.length) {
		const teamIds = teams.map((t) => t._id);
		await Promise.all([
			BaseUser.updateMany({ teams: { $in: teamIds } }, { $pull: { teams: { $in: teamIds } } }),
			Founder.updateMany({ owned_teams: { $in: teamIds } }, { $pull: { owned_teams: { $in: teamIds } } }),
		]);
		await Team.deleteMany({ _id: { $in: teamIds } });
	}

	// Commitments are only promises (no money moves yet), so they are cancelled, not blocked.
	const portfolios = await Portfolio.find({ 'investments.idea_id': { $in: ideaIds } }).select('investor_id investments').lean();
	for (const p of portfolios) {
		for (const inv of p.investments) {
			const ideaId = String(inv.idea_id);
			if (!titleOf.has(ideaId)) continue;
			const amount = Number(inv.amount_committed).toLocaleString('en-US');
			await pushNotification(
				p.investor_id,
				`A founder deleted “${titleOf.get(ideaId)}”. Your $${amount} commitment was cancelled; no money had moved.`,
				{ key: `idea-deleted:${ideaId}:${p.investor_id}`, link: '/investor/investments' },
			);
		}
	}
	if (portfolios.length) {
		await Portfolio.updateMany(
			{ 'investments.idea_id': { $in: ideaIds } },
			{ $pull: { investments: { idea_id: { $in: ideaIds } } } },
		);
	}

	await Investor.updateMany({ watchlist: { $in: ideaIds } }, { $pull: { watchlist: { $in: ideaIds } } });

	await Promise.all(ideaIds.map((id) => fs.promises.rm(path.join(UPLOADS_DIR, String(id)), { recursive: true, force: true })));

	await Idea.deleteMany({ _id: { $in: ideaIds } });
	const founders = [...new Set(ideas.map((i) => String(i.founder_id)))];
	await cache.del(...founders.map((f) => `user_ideas:${f}`));
};

module.exports = { purgeIdeas };
