const mongoose = require('mongoose');
const { Comment } = require('../models/comments.model.js');
const { Idea } = require('../models/ideas.model.js');
const { pushNotification } = require('./notifications.controller.js');
const client = require('../config/redis.js');
const {
    publishCommentAdded,
    publishCommentUpdated,
    publishCommentDeleted,
} = require('../utils/kafkaProducer.js');


const get_comments = async(req, res)=>{
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	const key = `comments:${id}`;
	try{
		try{
			const cached = await client.get(key);
			if(cached){
				return res.status(200).json({success:true, comments:JSON.parse(cached)});
			}
		}catch(error){
			console.error('Redis fetch error:', error);
		}

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

		await client.setEx(key, 3600, JSON.stringify(shaped));

		return res.status(200).json({ success: true, comments: shaped });
	} catch(err){
		console.error('get_comments:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
}

const add_comment = async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const user_id = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid idea ID' });
    }

    const commentId = new mongoose.Types.ObjectId().toString();
    const commentKey = `comment:${commentId}`;
    const zSetKey = `comments:${id}`;
    const statsKey = `idea_stats:${id}`;

    const timestampISO = new Date().toISOString();
    const scoreTimestamp = Date.now();           
    const TTL = 86400;

    try {
        const pipeline = client.multi();

        pipeline.hSet(commentKey, {
            id: commentId,                    
            text: text.trim(),
            timeStamp: timestampISO,
            user_id: user_id.toString(),
            author: req.user.name || 'Anonymous',
        });
        pipeline.expire(commentKey, TTL);

        pipeline.zAdd(zSetKey, {
            score: scoreTimestamp,               
            value: commentKey
        });
        pipeline.expire(zSetKey, TTL);

        pipeline.hIncrBy(statsKey, 'comments', 1); 

        await pipeline.exec();

        publishCommentAdded({
            commentId,
            postId:    id,
            userId:    user_id.toString(),
            text:      text.trim(),
            author:    req.user.name || 'Anonymous',
            timestamp: timestampISO,
        });

        return res.status(201).json({
            success: true,
            commentId
        });

    } catch (err) {
        console.error('add_comment_cached error:', err);
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
        const commentKey = `comment:${commentId}`;
        const cachedComment = await client.hGetAll(commentKey);

        if (cachedComment && cachedComment.user_id) {
            if (cachedComment.user_id !== user_id.toString()) {
                return res.status(403).json({ success: false, message: 'Forbidden' }); // Fixed: 403 status
            }

            await client.hSet(commentKey, { text: text.trim() });

            publishCommentUpdated({ commentId, text: text.trim() });

            return res.status(200).json({ success: true, text: text.trim() });
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        if (comment.userId.toString() !== user_id.toString()) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        comment.text = text.trim();
        await comment.save();

        await client.hSet(commentKey, {
            id: comment._id.toString(),
            postId: comment.postId.toString(),
            text: comment.text,
            user_id: comment.userId.toString(),
            author: req.user.name || 'Anonymous',
            timeStamp: comment.createdAt.toISOString()
        });
        await client.expire(commentKey, 86400);

        return res.status(200).json({ success: true, text: comment.text });

    } catch (error) {
        console.error('update_comment:', error);
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
        const commentKey = `comment:${commentId}`;

        try {
            const cachedComment = await client.hGetAll(commentKey);

            if (cachedComment && cachedComment.user_id) {
                const isAuthor = cachedComment.user_id === user_id.toString();
                const isPostOwner = cachedComment.postOwnerId === user_id.toString();

                if (!isAuthor && !isPostOwner) {
                    return res.status(403).json({ success: false, message: 'Forbidden' });
                }

                const zSetKey = `comments:${cachedComment.postId}`;
                const statsKey = `idea_stats:${cachedComment.postId}`;

                const pipeline = client.multi();
                pipeline.del(commentKey);                         
                pipeline.zRem(zSetKey, commentKey);             
                pipeline.hIncrBy(statsKey, 'comments', -1);       
                await pipeline.exec();

                publishCommentDeleted({ commentId, postId: cachedComment.postId });

                return res.status(200).json({ success: true, message: 'Comment deleted successfully' });
            }
        } catch (redisErr) {
            console.error('Redis cache error in delete_comment:', redisErr);
        }

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

        
        const zSetKey = `comments:${comment.postID}`;
        const statsKey = `idea_stats:${comment.postID}`;
        
        const cleanupPipeline = client.multi();
        cleanupPipeline.del(commentKey);
        cleanupPipeline.zRem(zSetKey, commentKey);
        cleanupPipeline.hIncrBy(statsKey, 'comments', -1);
        await cleanupPipeline.exec().catch(() => {}); 

        return res.status(200).json({ success: true, message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('delete_comment error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


module.exports = {
	get_comments,
	add_comment,
	update_comment,
	delete_comment
};