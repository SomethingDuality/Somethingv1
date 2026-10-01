const express = require('express');
const internal = require('../controllers/internal.controller.js');

const router = express.Router();

router.get('/context/:userId', internal.context);
router.post('/apply-update', internal.applyUpdateRoute);
router.post('/notify', internal.notify);
router.put('/questions/:confirmId', internal.putQuestion);
router.delete('/questions/:confirmId', internal.deleteQuestion);
router.get('/match/ideas', internal.matchIdeas);
router.get('/match/user/:userId', internal.matchUser);
router.get('/match/users', internal.matchUsers);
router.get('/health', internal.health);

module.exports = router;
