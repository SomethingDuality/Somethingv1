const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { Like } = require('../models/likes.model.js');
const client = require('../config/redis.js');
const { publishPostInteraction } = require('../utils/kafkaProducer.js');

const fetch_popular_posts = async (req, res) => {
	let { limit, genre } = req.body;
	limit = Math.min(Number(limit) || 10, 50);

	if (!genre) {
		return res.status(400).json({ success: false, message: 'genre is required' });
	}

	const normalizedGenre = genre.toLowerCase();
	const redisKey = `popular_posts:${normalizedGenre}:${limit}`;

	try {
		try{
			const cached = await client.get(redisKey);
			return res.status(200).json({success:true, posts:JSON.parse(cached)});
		} catch(redisErr){
			console.error('Failed to fetch from redis, fetching from db', redisErr);
		}

		const posts = await Idea
			.find({ stage: genre.toLowerCase(), isDraft: false })
			.sort({ likes: -1 })
			.limit(limit)
			.lean();

		await client.setEx(redisKey, 3600, JSON.stringify(posts)); // I will reduce the caching time if needed, later, or make it dynamic according to the surge

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
        // add validation
        
        const userIdStr = user_id.toString();
        const postIdStr = post_id.toString();

        const added = await client.sAdd(`likes:${postIdStr}`, userIdStr);

        if (added === 1) {
            const pipeline = client.multi();
            pipeline.zIncrBy('post_likes', 1, postIdStr);       
            pipeline.sRem(`dislikes:${postIdStr}`, userIdStr);   

            const results = await pipeline.exec();
            const removedDislike = results[1] === 1;

            if (removedDislike) {
                await client.zIncrBy('post_dislikes', -1, postIdStr);
            }

            publishPostInteraction({
                postId:  postIdStr,
                userId:  userIdStr,
                action:  'like',
                removed: false,
            });

            if (removedDislike) {
                publishPostInteraction({
                    postId:  postIdStr,
                    userId:  userIdStr,
                    action:  'dislike',
                    removed: true,
                });
            }
        }
        return res.status(200).json({ 
            success: true, 
            liked: added === 1,
            message: added === 1 ? 'Post liked successfully' : 'Already liked' 
        });

    } catch (err) {
        console.error('like_post error:', err);
        return res.status(500).json({ success: false, message: 'Error liking post' });
    }
};

const dislike_post = async(req, res)=>{
	const user_id = req.user._id;
	const { post_id } = req.params;

	try{
		// add validation
		const added = await client.sAdd(`dislikes:${post_id}`, user_id.toString());

		if(added === 1){
			const pipeline = client.multi();
			pipeline.zIncrBy('post_dislikes', 1, post_id.toString());
			pipeline.sRem(`likes:${post_id}`, user_id.toString());

			const results = await pipeline.exec();
			const removedLike = results[1] === 1;

			if(removedLike){
				await client.zIncrBy('post_likes', -1, post_id.toString());
			}

			publishPostInteraction({
				postId:  post_id.toString(),
				userId:  user_id.toString(),
				action:  'dislike',
				removed: false,
			});

			if (removedLike) {
				publishPostInteraction({
					postId:  post_id.toString(),
					userId:  user_id.toString(),
					action:  'like',
					removed: true,
				});
			}
		}

		return res.status(200).json({
			success: true,
			disliked: added === 1,
			message: added === 1 ? 'Post disliked successfully' : 'Already disliked'
		});
	} catch(err){
		console.error('dislike_post error:', err);
		return res.status(500).json({ success: false, message: 'Error disliking post' });
	}
}

module.exports = { fetch_popular_posts, like_post, dislike_post };