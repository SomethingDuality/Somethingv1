const express = require('express');
const router  = express.Router();

const { signup, login, me, logout, refresh, forgot_password, reset_password, delete_account } = require('../controllers/user.controller.js');
const { protect } = require('../middleware/auth.middleware.js');


router.post('/signup', signup);


router.post('/login', login);


router.get('/me', protect, me);



router.post('/refresh', refresh);


router.post('/logout', logout);



router.post('/forgot-password', forgot_password);


router.post('/reset-password', reset_password);



router.delete('/account', protect, delete_account);

module.exports = router;
