const mongoose = require('mongoose');
const { Comment } = require('../models/comments.model.js');
const { Idea } = require('../models/ideas.model.js');
const { pushNotification } = require('./notifications.controller.js');


const get_comments = async (req, res) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		const comments = await Comment.find({ postID: id })
			.populate('userId', 'name')
			.sort({ createdAt: 1 })
			.lean();

		
		const shaped = comments.map(c => ({
			id: c._id,
			author: (c.userId && c.userId.name) ? c.userId.name : 'Anonymous',
			text: c.text,
			timestamp: new Date(c.createdAt).toLocaleDateString()
		}));

		return res.status(200).json(shaped);
	} catch (err) {
		console.error('get_comments:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const add_comment = async (req, res) => {
	const { id } = req.params;
	const { text } = req.body;
	const user_id = req.user._id;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	if (!text || !text.trim()) {
		return res.status(400).json({ success: false, message: 'Comment text is required' });
	}

	try {
		const idea = await Idea.findById(id).select('founder_id title').lean();
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		const newComment = await Comment.create({
			postID: id,
			userId: user_id,
			text: text.trim()
		});

		
		await Idea.findByIdAndUpdate(id, { $inc: { comments: 1 } });

		
		if (idea.founder_id.toString() !== user_id.toString()) {
			const notificationText = `User ${req.user.name} commented: "${text.trim().substring(0, 40)}${text.trim().length > 40 ? '...' : ''}" on your idea "${idea.title}"`;
			await pushNotification(idea.founder_id, notificationText);
		}

		
		return res.status(201).json({
			success: true,
			comment: {
				id: newComment._id,
				author: req.user.name,
				text: newComment.text,
				timestamp: 'Just now'
			}
		});
	} catch (err) {
		console.error('add_comment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const update_comment = async (req, res) => {
	const { commentId } = req.params;
	const { text } = req.body;
	const user_id = req.user._id;

	if (!mongoose.Types.ObjectId.isValid(commentId)) {
		return res.status(400).json({ success: false, message: 'Invalid comment ID' });
	}

	if (!text || !text.trim()) {
		return res.status(400).json({ success: false, message: 'Comment text is required' });
	}

	try {
		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res.status(404).json({ success: false, message: 'Comment not found' });
		}

		
		if (comment.userId.toString() !== user_id.toString()) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		comment.text = text.trim();
		await comment.save();

		return res.status(200).json({ success: true, text: comment.text });
	} catch (err) {
		console.error('update_comment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const delete_comment = async (req, res) => {
	const { commentId } = req.params;
	const user_id = req.user._id;

	if (!mongoose.Types.ObjectId.isValid(commentId)) {
		return res.status(400).json({ success: false, message: 'Invalid comment ID' });
	}

	try {
		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res.status(404).json({ success: false, message: 'Comment not found' });
		}

		
		const idea = await Idea.findById(comment.postID).select('founder_id').lean();
		const isAuthor = comment.userId.toString() === user_id.toString();
		const isPostOwner = idea && idea.founder_id.toString() === user_id.toString();

		if (!isAuthor && !isPostOwner) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		await Comment.findByIdAndDelete(commentId);

		
		await Idea.findByIdAndUpdate(comment.postID, { $inc: { comments: -1 } });

		return res.status(200).json({ success: true, message: 'Comment deleted successfully' });
	} catch (err) {
		console.error('delete_comment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = {
	get_comments,
	add_comment,
	update_comment,
	delete_comment
};
