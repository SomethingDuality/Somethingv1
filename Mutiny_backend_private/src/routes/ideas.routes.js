const express = require('express');
const multer  = require('multer');
const mongoose = require('mongoose');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

const {
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
} = require('../controllers/ideas.controller.js');

const {
	get_comments,
	add_comment,
	update_comment,
	delete_comment
} = require('../controllers/comments.controller.js');

const { protect, optionalAuth } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');

const commentLimiter = make('comments', { windowMs: 10 * 60 * 1000, limit: 20, byUser: true });
const { list_updates, post_update, delete_update, request_update } = require('../controllers/updates.controller.js');
const { add_milestone, update_milestone, delete_milestone } = require('../controllers/milestones.controller.js');




const { Idea } = require('../models/ideas.model.js');
const uploads = require('../utils/uploads.js');

// The id, the owner and the file count are checked before multer writes a byte (X-5, X-8); the
// folder is named from the stored idea's id, never from the URL.
const ownIdeaForUpload = async (req, res, next) => {
	if (!mongoose.isObjectIdOrHexString(req.params.id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}
	const idea = await Idea.findById(req.params.id).select('founder_id attachments').lean();
	if (!idea) return res.status(404).json({ success: false, message: 'Idea not found' });
	if (String(idea.founder_id) !== String(req.user._id)) {
		return res.status(403).json({ success: false, message: 'Not authorized to add attachments to this idea' });
	}
	if ((idea.attachments || []).length >= uploads.MAX_ATTACHMENTS) {
		return res.status(400).json({ success: false, message: `An idea can have up to ${uploads.MAX_ATTACHMENTS} files` });
	}
	req.uploadDir = path.join(uploads.IDEAS_DIR, String(idea._id));
	await fs.promises.mkdir(req.uploadDir, { recursive: true });
	return next();
};

const uploadAttachment = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, req.uploadDir),
		filename: uploads.filenameFor(uploads.ATTACHMENT_TYPES),
	}),
	fileFilter: uploads.filterFor(uploads.ATTACHMENT_TYPES, 'File type not allowed'),
	limits: { fileSize: 50 * 1024 * 1024, files: 1 },
	defParamCharset: 'utf8', // browsers send UTF-8 file names; the default (latin1) garbles them
});


router.get('/discover',  optionalAuth, fetch_discover_ideas);


router.get('/user',      protect, fetch_user_ideas);
router.post('/',         protect, create_idea);


router.get('/:id',                    optionalAuth, fetch_idea_by_id);
router.put('/:id',                    protect, update_idea);
router.delete('/:id',                 protect, delete_idea);
router.post('/:id/like',              protect, like_idea);
router.delete('/:id/like',            protect, unlike_idea);


router.post('/:id/attachments',               protect, ownIdeaForUpload, uploadAttachment.single('file'), uploads.checkMagic(uploads.ATTACHMENT_TYPES), upload_attachment);
router.delete('/:id/attachments/:filename',   protect, delete_attachment);


router.post('/:id/collaborate',               protect, require('../middleware/rateLimits.js').chatRequestLimiter, request_collaboration);

// Founder updates; investors can ask for one (once a week per idea).
router.get('/:id/updates',                   optionalAuth, list_updates);
router.post('/:id/updates',                  protect, post_update);
router.delete('/:id/updates/:updateId',      protect, delete_update);
router.post('/:id/request-update',           protect, request_update);

// Milestones (the founder's); investors record releases against done ones.
router.post('/:id/milestones',               protect, add_milestone);
router.put('/:id/milestones/:mid',           protect, update_milestone);
router.delete('/:id/milestones/:mid',        protect, delete_milestone);


router.get('/:id/comments',                   optionalAuth, get_comments);
router.post('/:id/comments',                  protect, commentLimiter, add_comment);
router.put('/comments/:commentId',            protect, commentLimiter, update_comment);
router.delete('/comments/:commentId',         protect, delete_comment);

module.exports = router;
