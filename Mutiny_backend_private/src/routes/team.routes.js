const express = require('express');
const router  = express.Router();

const {
	create_team,
	list_teams,
	get_team,
	update_team,
	delete_team,
	add_member,
	remove_member
} = require('../controllers/team.controller.js');

const { protect } = require('../middleware/auth.middleware.js');


router.use(protect);


router.post('/',    create_team);  
router.get('/',     list_teams);   
router.get('/:id',  get_team);     
router.put('/:id',  update_team);  
router.delete('/:id', delete_team);  


router.post('/:id/members',             add_member);    
router.delete('/:id/members/:userId',   remove_member); 

module.exports = router;
