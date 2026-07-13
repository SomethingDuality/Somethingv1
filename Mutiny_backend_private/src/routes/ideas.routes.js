const express = require('express');
const multer  = require('multer');
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

const { protect } = require('../middleware/auth.middleware.js');




const attachmentStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const dir = path.join(__dirname, '../../uploads/ideas', req.params.id);
		fs.mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		
		const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
		cb(null, `${Date.now()}-${safe}`);
	}
});

const attachmentFilter = (req, file, cb) => {
	const allowed = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'video/mp4', 'video/webm', 'video/quicktime',
		'audio/mpeg', 'audio/wav', 'audio/ogg',
	];
	if (allowed.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('File type not allowed'), false);
	}
};

const uploadAttachment = multer({
	storage: attachmentStorage,
	fileFilter: attachmentFilter,
	limits: { fileSize: 50 * 1024 * 1024 } 
});


router.get('/discover',  fetch_discover_ideas);


router.get('/user',      protect, fetch_user_ideas);
router.post('/',         protect, create_idea);


router.get('/:id',                    fetch_idea_by_id);
router.put('/:id',                    protect, update_idea);
router.delete('/:id',                 protect, delete_idea);
router.post('/:id/like',              protect, like_idea);
router.delete('/:id/like',            protect, unlike_idea);


router.post('/:id/attachments',               protect, uploadAttachment.single('file'), upload_attachment);
router.delete('/:id/attachments/:filename',   protect, delete_attachment);


router.post('/:id/collaborate',               protect, request_collaboration);


router.get('/:id/comments',                   get_comments);
router.post('/:id/comments',                  protect, add_comment);
router.put('/comments/:commentId',            protect, update_comment);
router.delete('/comments/:commentId',         protect, delete_comment);

module.exports = router;
