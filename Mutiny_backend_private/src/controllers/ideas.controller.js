const mongoose = require('mongoose');
const { Idea }    = require('../models/ideas.model.js');
const { Founder, BaseUser } = require('../models/user.model.js');
const { Team } = require('../models/team.model.js');
const { Portfolio } = require('../models/portfolio.model.js');
const { pushNotification } = require('../services/notifications.service.js');
const cache = require('../utils/cache.js');
const tax = require('../shared/taxonomy.js');
const { addLike, removeLike } = require('../services/likes.service.js');
const { purgeIdeas } = require('../services/ideaPurge.js');
const { respondLikeError } = require('./feed.controller.js');
const { FIELDS, FieldError, sourceKey, isAnswered } = require('../profile/fields.js');

// Validates/normalizes idea fields through the shared registry (tags → sector ids, roles → role ids)
// and records where each value came from, like profile/applyUpdate.js does for users.
const IDEA_KEYS = ['title', 'description', 'stage', 'tags', 'lookingFor', 'raising', 'isDraft'];
const cleanIdeaFields = (body, source) => {
	const values = {};
	const sources = {};
	const at = new Date();
	for (const k of IDEA_KEYS) {
		if (body[k] === undefined) continue;
		values[k] = FIELDS.idea[k].set(body[k], k);
		// null = clear the source; only a real value counts as an answer.
		if (k !== 'isDraft') sources[sourceKey(k)] = isAnswered(values[k]) ? { source, at } : null;
	}
	return { values, sources };
};
const {
    publishIdeaCreated,
    publishIdeaUpdated,
    publishIdeaDeleted,
} = require('../utils/kafkaProducer.js');

const makeExcerpt = (text = '', limit = 120) =>
	text.length > limit ? text.slice(0, limit) + '...' : text;


const requireFounder = async (user_id) => {
	return Founder.findById(user_id).lean();
};


const fetch_user_ideas = async (req, res) => {
    const user_id = req.user._id;
    const key = `user_ideas:${user_id}`;

    try {
        const cached = await cache.getJSON(key);
        if (cached) {
            return res.status(200).json(cached);
        }

        const founder = await requireFounder(user_id);
        if (!founder) {
            return res.status(403).json({ success: false, message: 'Founder account required' });
        }

        const ideas = await Idea.find({ founder_id: user_id })
            .sort({ createdAt: -1 })
            .lean();

        await cache.setJSON(key, ideas, 3600);

        return res.status(200).json(ideas);

    } catch (error) {
        console.error('fetch_user_ideas error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// A founder's free-text location ("Pune, India", "Koramangala, Bangalore") as a known
// locations id when one appears in it, else "other". Clean values for filters and matching (P17).
const locationIdOf = (text) => {
	const s = String(text || '').trim();
	if (!s) return null;
	for (const part of [s, ...s.split(/[,/|·]+/)]) {
		const id = tax.normalize('locations', part);
		if (id && tax.isKnown('locations', id)) return id;
	}
	return 'other';
};

const fetch_discover_ideas = async (req, res) => {
	try {
		const ideas = await Idea.find({ isDraft: false })
			.sort({ createdAt: -1 })
			.lean();

		// Each idea carries its founder's location (from the founder profile).
		const founders = await Founder.find({ _id: { $in: [...new Set(ideas.map((i) => String(i.founder_id)))] } })
			.select('location avatar').lean();
		const byId = new Map(founders.map((f) => [String(f._id), f]));

		return res.status(200).json(ideas.map((i) => {
			const f = byId.get(String(i.founder_id));
			const location = f?.location || '';
			return { ...i, founderLocation: location, locationId: locationIdOf(location), founderAvatar: f?.avatar || '' };
		}));
	} catch (err) {
		console.error('fetch_discover_ideas:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const fetch_idea_by_id = async (req, res) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const idea = await Idea.findById(id).lean();
		// A draft is visible only to its founder; everyone else gets the same 404 as a missing idea.
		const isOwner = req.user && String(idea?.founder_id) === String(req.user._id);
		if (!idea || (idea.isDraft && !isOwner)) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		// Fire-and-forget, but never let a failed counter write become an unhandled rejection.
		Idea.updateOne({ _id: id }, { $inc: { views: 1 } }).exec().catch(() => {});

		// What an investor needs next to the pitch: who the founder is, who is on the team, and
		// how much has been committed (a total only; individual investors stay private).
		const [founder, team, portfolios] = await Promise.all([
			Founder.findById(idea.founder_id).select('name headline location avatar socials linkedin github').lean(),
			Team.findOne({ idea_id: idea._id }).select('members').lean(),
			Portfolio.find({ 'investments.idea_id': idea._id }).select('investments.idea_id investments.amount_committed investments.amount_released').lean(),
		]);
		const commitments = { count: 0, total: 0, released: 0 };
		for (const p of portfolios) {
			for (const inv of p.investments) {
				if (String(inv.idea_id) !== String(idea._id)) continue;
				commitments.count += 1;
				commitments.total += inv.amount_committed || 0;
				commitments.released += inv.amount_released || 0;
			}
		}

		return res.status(200).json({
			...idea,
			founder: founder ? {
				id:       founder._id,
				name:     founder.name || idea.author || '',
				headline: founder.headline || '',
				location: founder.location || '',
				avatarUrl: founder.avatar || '',
				links: {
					linkedin: founder.socials?.linkedin || founder.linkedin || '',
					github:   founder.socials?.github   || founder.github   || '',
					website:  founder.socials?.website  || '',
					twitter:  founder.socials?.twitter  || '',
				},
			} : null,
			team: (team?.members || []).map((m) => ({ name: m.name || 'Team member', role: m.role || '', isFounder: String(m.user_id) === String(idea.founder_id) })),
			commitments,
		});
	} catch (err) {
		console.error('fetch_idea_by_id:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const create_idea = async (req, res) => {
	const user_id = req.user._id;
	const {
		title,
		description,
		tags,
		stage,
		lookingFor,
		raising,
		isDraft,
		attachments
	} = req.body;

	// Only a title and a description are required; the Something box asks for the rest later.
	if (!title || !description) {
		return res.status(400).json({
			success: false,
			message: 'title and description are required'
		});
	}

	let cleaned;
	try {
		cleaned = cleanIdeaFields({ title, description, stage, tags, lookingFor, raising, isDraft }, 'profile');
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
		throw err;
	}

	try {
		const founder = await requireFounder(user_id);
		if (!founder) {
			return res.status(403).json({ success: false, message: 'Founder account required' });
		}

		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);

		const todayCount = await Idea.countDocuments({
			founder_id: user_id,
			createdAt: { $gte: startOfToday }
		});

		if (todayCount >= 3) {
			return res.status(429).json({
				success: false,
				message: 'You can only post 3 ideas per day'
			});
		}

		const v = cleaned.values;
		const idea = new Idea({
			founder_id:   user_id,
			author:       founder.name,
			title:        v.title,
			description:  v.description,
			desc:         makeExcerpt(v.description),
			tags:         v.tags ?? [],
			stage:        v.stage || undefined,
			lookingFor:   v.lookingFor ?? [],
			raising:      v.raising || '',
			isDraft:      Boolean(v.isDraft),
			attachments:  Array.isArray(attachments) ? attachments : [],
			fieldSources: Object.fromEntries(Object.entries(cleaned.sources).filter(([, v]) => v)),
		});

		await idea.save();
		await cache.del(`user_ideas:${user_id}`);

		publishIdeaCreated({
			ideaId:    idea._id.toString(),
			founderId: user_id.toString(),
			title:     idea.title,
			stage:     idea.stage,
			tags:      idea.tags,
		});

		return res.status(201).json(idea.toObject());
	} catch (err) {
		console.error('create_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const update_idea = async (req, res) => {
	const user_id = req.user._id;
	const { id }  = req.params;
	const {
		title,
		description,
		tags,
		stage,
		lookingFor,
		raising,
		isDraft,
		attachments
	} = req.body;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const idea = await Idea.findById(id);
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		if (idea.founder_id.toString() !== user_id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized to edit this idea' });
		}

		let cleaned;
		try {
			cleaned = cleanIdeaFields({ title, description, stage, tags, lookingFor, raising, isDraft }, 'profile');
		} catch (err) {
			if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
			throw err;
		}
		for (const [k, v] of Object.entries(cleaned.values)) idea[k] = v;
		if (cleaned.values.description !== undefined) idea.desc = makeExcerpt(cleaned.values.description);
		for (const [k, v] of Object.entries(cleaned.sources)) idea.set(`fieldSources.${k}`, v ?? undefined);
		if (attachments !== undefined) idea.attachments = Array.isArray(attachments) ? attachments : [];

		await idea.save();
		await cache.del(`user_ideas:${user_id}`);

		publishIdeaUpdated({
			ideaId:  id,
			changes: {
				...(title       !== undefined && { title:       idea.title }),
				...(description !== undefined && { description: true }),
				...(stage       !== undefined && { stage:       idea.stage }),
				...(tags        !== undefined && { tags:        idea.tags }),
				...(lookingFor  !== undefined && { lookingFor:  idea.lookingFor }),
				...(raising     !== undefined && { raising:     idea.raising }),
				...(isDraft     !== undefined && { isDraft:     idea.isDraft }),
				...(attachments !== undefined && { attachments: true }),
			},
		});

		return res.status(200).json(idea.toObject());
	} catch (err) {
		console.error('update_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const delete_idea = async (req, res) => {
	const user_id = req.user._id;
	const { id }  = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const idea = await Idea.findById(id);
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		if (idea.founder_id.toString() !== user_id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized to delete this idea' });
		}

		// Removes its likes, comments, team, files and commitments too (P16, X-46).
		await purgeIdeas([idea._id]);

		publishIdeaDeleted({ ideaId: id, founderId: user_id.toString() });

		return res.status(200).json({ success: true, message: 'Idea deleted' });
	} catch (err) {
		console.error('delete_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const like_idea = async (req, res) => {
	try {
		const result = await addLike(req.params.id, req.user._id);
		return res.status(200).json({ success: true, ...result });
	} catch (err) {
		return respondLikeError(res, err, 'like_idea');
	}
};

const unlike_idea = async (req, res) => {
	try {
		const result = await removeLike(req.params.id, req.user._id);
		return res.status(200).json({ success: true, ...result });
	} catch (err) {
		return respondLikeError(res, err, 'unlike_idea');
	}
};




const upload_attachment = async (req, res) => {
	const user_id = req.user._id;
	const { id }  = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	if (!req.file) {
		return res.status(400).json({ success: false, message: 'No file uploaded' });
	}

	try {
		const idea = await Idea.findById(id);
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		if (idea.founder_id.toString() !== user_id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized to add attachments to this idea' });
		}

		
		const mimeToType = {
			'application/pdf':                                                         'document',
			'application/msword':                                                      'document',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
			'application/vnd.ms-powerpoint':                                           'presentation',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
			'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
			'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio',
		};
		const fileType = mimeToType[req.file.mimetype] || 'document';

		
		const fileUrl = `/uploads/ideas/${id}/${req.file.filename}`;

		const attachment = {
			name: req.file.originalname,
			size: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
			type: fileType,
			url:  fileUrl,
		};

		idea.attachments.push(attachment);
		await idea.save();

		return res.status(201).json({ success: true, attachment });
	} catch (err) {
		console.error('upload_attachment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const upload_attachment_delete = async (req, res) => {
	const user_id    = req.user._id;
	const { id, filename } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const idea = await Idea.findById(id);
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		if (idea.founder_id.toString() !== user_id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized' });
		}

		const before = idea.attachments.length;
		idea.attachments = idea.attachments.filter(a => a.name !== filename && !a.url?.endsWith(filename));

		if (idea.attachments.length === before) {
			return res.status(404).json({ success: false, message: 'Attachment not found' });
		}

		await idea.save();

		
		const path = require('path');
		const fs   = require('fs');
		const filePath = path.join(__dirname, '../../uploads/ideas', id, filename);
		fs.unlink(filePath, () => {});

		return res.status(200).json({ success: true, message: 'Attachment removed' });
	} catch (err) {
		console.error('delete_attachment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const delete_attachment = upload_attachment_delete;

const request_collaboration = async (req, res) => {
	const user_id = req.user._id;
	const { id }  = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const idea = await Idea.findById(id).select('founder_id').lean();
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		const ownerId = idea.founder_id;
		if (!ownerId) {
			return res.status(400).json({ success: false, message: 'Idea owner not found' });
		}

		if (ownerId.toString() === user_id.toString()) {
			return res.status(400).json({ success: false, message: 'You are the owner of this idea' });
		}

		
		const requester = await BaseUser.findById(user_id).select('name email').lean();
		if (!requester) {
			return res.status(404).json({ success: false, message: 'Requester user not found' });
		}

		const name = requester.name || 'Anonymous';
		const email = requester.email || 'no-email@example.com';
		const notificationText = `User ${name} (${email}) asked to collaborate`;

		// One notification per requester per idea: repeated clicks can't spam the owner.
		await pushNotification(ownerId, notificationText, { key: `collab:${id}:${user_id}` });

		return res.status(200).json({ success: true, message: 'Collaboration request sent successfully' });
	} catch (err) {
		console.error('request_collaboration:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


module.exports = {
	fetch_user_ideas,
	fetch_discover_ideas,
	fetch_idea_by_id,
	create_idea,
	update_idea,
	delete_idea,
	like_idea,
	unlike_idea,
	upload_attachment,
	delete_attachment,
	request_collaboration,
};