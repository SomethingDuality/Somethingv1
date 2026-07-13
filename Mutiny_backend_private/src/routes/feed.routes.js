const express = require('express');
const router  = express.Router();

const { fetch_popular_posts, like_post, unlike_post } = require('../controllers/feed.controller.js');
const { protect } = require('../middleware/auth.middleware.js');


router.post('/', fetch_popular_posts);


router.post('/like/:post_id',   protect, like_post);
router.post('/unlike/:post_id', protect, unlike_post);

module.exports = router;
