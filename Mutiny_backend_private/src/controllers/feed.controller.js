const { Idea } = require('../models/ideas.model.js');
const cache = require('../utils/cache.js');
const { addLike, removeLike, LikeError } = require('../services/likes.service.js');
const { PUBLIC_IDEA } = require('../community/targets.js');

// Only real idea stages are valid "genres", so arbitrary input can't mint unbounded cache keys.
const GENRES = Idea.schema.path('stage').enumValues;

const fetch_popular_posts = async (req, res) => {
	let { limit, genre } = req.body || {};
	limit = Math.min(Number(limit) || 10, 50);

	const normalizedGenre = String(genre || '').toLowerCase();
	if (!GENRES.includes(normalizedGenre)) {
		return res.status(400).json({ success: false, message: `genre must be one of: ${GENRES.join(', ')}` });
	}

	const cacheKey = `popular_posts:v1:${normalizedGenre}:${limit}`;

	try {
		const cached = await cache.getJSON(cacheKey);
		if (cached) return res.status(200).json({ success: true, posts: cached });

		const posts = await Idea
			.find({ ...PUBLIC_IDEA, stage: normalizedGenre })
			.select('-moderation')
			.sort({ likes: -1 })
			.limit(limit)
			.lean();

		await cache.setJSON(cacheKey, posts, 300);

		return res.status(200).json({ success: true, posts });
	} catch (err) {
		console.error('fetch_popular_posts:', err);
		return res.status(500).json({ success: false, message: 'Problem fetching feed' });
	}
};

const respondLikeError = (res, err, action) => {
	if (err instanceof LikeError) {
		return res.status(err.status).json({ success: false, message: err.message, ...(err.code && { code: err.code }) });
	}
	console.error(`${action}:`, err);
	return res.status(500).json({ success: false, message: 'Internal server error' });
};

const like_post = async (req, res) => {
	try {
		const result = await addLike(req.params.post_id, req.user._id);
		return res.status(200).json({ success: true, ...result });
	} catch (err) {
		return respondLikeError(res, err, 'like_post');
	}
};

const unlike_post = async (req, res) => {
	try {
		const result = await removeLike(req.params.post_id, req.user._id);
		return res.status(200).json({ success: true, ...result });
	} catch (err) {
		return respondLikeError(res, err, 'unlike_post');
	}
};

module.exports = { fetch_popular_posts, like_post, unlike_post, respondLikeError };
