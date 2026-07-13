const mongoose = require('mongoose');
const { Idea }    = require('../models/ideas.model.js');
const { Like }    = require('../models/likes.model.js');
const { Founder, BaseUser } = require('../models/user.model.js');
const { pushNotification } = require('./notifications.controller.js');



const makeExcerpt = (text = '', limit = 120) =>
	text.length > limit ? text.slice(0, limit) + '...' : text;


const requireFounder = async (user_id) => {
	return Founder.findById(user_id).lean();
};


const fetch_user_ideas = async (req, res) => {
	const user_id = req.user._id;

	try {
		const founder = await requireFounder(user_id);
		if (!founder) {
			return res.status(403).json({ success: false, message: 'Founder account required' });
		}

		const ideas = await Idea.find({ founder_id: user_id })
			.sort({ createdAt: -1 })
			.lean();

		return res.status(200).json(ideas);
	} catch (err) {
		console.error('fetch_user_ideas:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const fetch_discover_ideas = async (req, res) => {
	try {
		const ideas = await Idea.find({ isDraft: false })
			.sort({ createdAt: -1 })
			.lean();

		return res.status(200).json(ideas);
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
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}


		Idea.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec();

		return res.status(200).json(idea);
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
		isDraft,
		attachments
	} = req.body;

	if (!title || !description || !stage) {
		return res.status(400).json({
			success: false,
			message: 'title, description and stage are required'
		});
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

		const idea = new Idea({
			founder_id:  user_id,
			author:      founder.name,
			title:       title.trim(),
			description,
			desc:        makeExcerpt(description),
			tags:        Array.isArray(tags) ? tags : [],
			stage,
			lookingFor:  Array.isArray(lookingFor) ? lookingFor : [],
			isDraft:     Boolean(isDraft),
			attachments: Array.isArray(attachments) ? attachments : []
		});

		await idea.save();

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

		if (title)       idea.title       = title.trim();
		if (description) { idea.description = description; idea.desc = makeExcerpt(description); }
		if (stage)       idea.stage       = stage;
		if (tags        !== undefined) idea.tags        = Array.isArray(tags)        ? tags        : [];
		if (lookingFor  !== undefined) idea.lookingFor  = Array.isArray(lookingFor)  ? lookingFor  : [];
		if (isDraft     !== undefined) idea.isDraft     = Boolean(isDraft);
		if (attachments !== undefined) idea.attachments = Array.isArray(attachments) ? attachments : [];

		await idea.save();

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

		await idea.deleteOne();

		return res.status(200).json({ success: true, message: 'Idea deleted' });
	} catch (err) {
		console.error('delete_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const like_idea = async (req, res) => {
	const user_id = req.user._id;
	const { id }  = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const idea = await Idea.findById(id).select('_id likes').lean();
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		
		const result = await Like.updateOne(
			{ postID: id, userId: user_id },
			{ $setOnInsert: { postID: id, userId: user_id } },
			{ upsert: true }
		);

		if (result.upsertedCount === 0) {
			
			const current = await Idea.findById(id).select('likes').lean();
			return res.status(200).json({ success: true, likes: current.likes, alreadyLiked: true });
		}

		
		const updated = await Idea.findByIdAndUpdate(
			id,
			{ $inc: { likes: 1 } },
			{ new: true }
		).select('likes').lean();

		return res.status(200).json({ success: true, likes: updated.likes, alreadyLiked: false });
	} catch (err) {
		console.error('like_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const unlike_idea = async (req, res) => {
	const user_id = req.user._id;
	const { id }  = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const deleted = await Like.deleteOne({ postID: id, userId: user_id });

		if (deleted.deletedCount === 0) {
			return res.status(200).json({ success: true, message: 'Not liked', alreadyUnliked: true });
		}

		
		const updated = await Idea.findByIdAndUpdate(
			id,
			{ $inc: { likes: -1 } },
			{ new: true }
		).select('likes').lean();

		if (!updated) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		return res.status(200).json({ success: true, likes: Math.max(0, updated.likes) });
	} catch (err) {
		console.error('unlike_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
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

		await pushNotification(ownerId, notificationText);

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
