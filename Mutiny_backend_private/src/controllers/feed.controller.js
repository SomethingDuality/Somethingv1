const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { Like } = require('../models/likes.model.js');


const fetch_popular_posts = async (req, res) => {
	let { limit, genre } = req.body;
	limit = Math.min(Number(limit) || 10, 50);

	if (!genre) {
		return res.status(400).json({ success: false, message: 'genre is required' });
	}

	try {
		const posts = await Idea
			.find({ stage: genre.toLowerCase(), isDraft: false })
			.sort({ likes: -1 })
			.limit(limit)
			.lean();

		return res.status(200).json({ success: true, posts });
	} catch (err) {
		console.error('fetch_popular_posts:', err);
		return res.status(404).json({ success: false, message: 'Problem fetching feed' });
	}
};


const validateIds = (user_id, post_id) => {
	if (
		!mongoose.Types.ObjectId.isValid(user_id) ||
		!mongoose.Types.ObjectId.isValid(post_id)
	) {
		throw new Error('Invalid IDs');
	}
};

const fetchPost = async (post_id) => {
	const post = await Idea.findById(post_id);
	if (!post) throw new Error('Post not found');
	return post;
};

const addLike = async (post_id, user_id) => {
	await Like.updateOne(
		{ postID: post_id, userId: user_id },
		{ $setOnInsert: { postID: post_id, userId: user_id } },
		{ upsert: true }
	);
	await Idea.findByIdAndUpdate(post_id, { $inc: { likes: 1 } });
};

const removeLike = async (post_id, user_id) => {
	const deleted = await Like.deleteOne({ postID: post_id, userId: user_id });
	
	if (deleted.deletedCount > 0) {
		await Idea.findByIdAndUpdate(post_id, { $inc: { likes: -1 } });
	}
};


const like_post = async (req, res) => {
	const user_id = req.user._id;
	const { post_id } = req.params;

	try {
		validateIds(user_id, post_id);
		await fetchPost(post_id);
		await addLike(post_id, user_id);
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('like_post:', err);
		const status = ['Post not found', 'Invalid IDs'].includes(err.message) ? 404 : 400;
		return res.status(status).json({ success: false, message: err.message });
	}
};


const unlike_post = async (req, res) => {
	const user_id = req.user._id;
	const { post_id } = req.params;

	try {
		validateIds(user_id, post_id);
		await fetchPost(post_id);
		await removeLike(post_id, user_id);
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('unlike_post:', err);
		const status = ['Post not found', 'Invalid IDs'].includes(err.message) ? 404 : 400;
		return res.status(status).json({ success: false, message: err.message });
	}
};

module.exports = { fetch_popular_posts, like_post, unlike_post };
