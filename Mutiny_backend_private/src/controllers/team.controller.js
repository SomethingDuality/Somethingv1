const mongoose = require('mongoose');
const { Team }    = require('../models/team.model.js');
const { Idea }    = require('../models/ideas.model.js');
const { BaseUser, Founder } = require('../models/user.model.js');
const { pushNotification } = require('../services/notifications.service.js');



const assertFounder = (req, res) => {
	if (req.user.role !== 'Founder') {
		res.status(403).json({ success: false, message: 'Founder account required' });
		return false;
	}
	return true;
};


const getInitials = (name) => {
	if (!name) return '';
	return name
		.trim()
		.split(/\s+/)
		.map(word => word[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
};




const create_team = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const { idea_id, name } = req.body;

	if (!idea_id || !mongoose.Types.ObjectId.isValid(idea_id)) {
		return res.status(400).json({ success: false, message: 'Valid idea_id is required' });
	}

	try {
		
		const idea = await Idea.findById(idea_id).select('title founder_id').lean();
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}
		if (idea.founder_id.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'You can only create teams for your own ideas' });
		}

		
		const existing = await Team.findOne({ idea_id });
		if (existing) {
			return res.status(409).json({
				success: false,
				message: 'A team already exists for this idea',
				teamId: existing._id
			});
		}

		
		const founder = await Founder.findById(req.user._id).select('name').lean();

		
		const team = new Team({
			idea_id,
			founder_id: req.user._id,
			name: name || idea.title,  
			members: [{
				user_id:    req.user._id,
				name:       founder?.name || '',
				initials:   getInitials(founder?.name || ''),
				role:       'Founder',
				lastActive: new Date()
			}],
			investors: []
		});

		await team.save();

		
		await Founder.findByIdAndUpdate(req.user._id, {
			$addToSet: {
				owned_teams: team._id,
				teams:       team._id
			}
		});

		return res.status(201).json({
			success: true,
			message: 'Team created',
			team: team.toObject()
		});

	} catch (err) {
		console.error('create_team:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const list_teams = async (req, res) => {
	if (!assertFounder(req, res)) return;

	try {
		const teams = await Team
			.find({ founder_id: req.user._id })
			.populate('idea_id', 'title stage')
			.lean();

		return res.status(200).json(teams);
	} catch (err) {
		console.error('list_teams:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const get_team = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid team ID' });
	}

	try {
		const team = await Team
			.findById(id)
			.populate('idea_id', 'title stage tags')
			.populate('investors', 'name firm avatar')
			.lean();

		if (!team) {
			return res.status(404).json({ success: false, message: 'Team not found' });
		}

		
		if (team.founder_id.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'Access denied' });
		}

		return res.status(200).json(team);
	} catch (err) {
		console.error('get_team:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};




const update_team = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const { id } = req.params;
	const { name } = req.body;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid team ID' });
	}

	if (!name || typeof name !== 'string' || !name.trim()) {
		return res.status(400).json({ success: false, message: 'name is required' });
	}

	try {
		const team = await Team.findById(id);
		if (!team) {
			return res.status(404).json({ success: false, message: 'Team not found' });
		}

		if (team.founder_id.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'Only the team owner can update it' });
		}

		team.name = name.trim();
		await team.save();

		return res.status(200).json({
			success: true,
			message: 'Team updated',
			team: team.toObject()
		});

	} catch (err) {
		console.error('update_team:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const delete_team = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid team ID' });
	}

	try {
		const team = await Team.findById(id);
		if (!team) {
			return res.status(404).json({ success: false, message: 'Team not found' });
		}

		if (team.founder_id.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'Only the team owner can delete it' });
		}

		
		const memberIds = team.members.map(m => m.user_id);
		await BaseUser.updateMany(
			{ _id: { $in: memberIds } },
			{ $pull: { teams: team._id } }
		);

		
		await Founder.findByIdAndUpdate(req.user._id, {
			$pull: { owned_teams: team._id }
		});

		await team.deleteOne();

		return res.status(200).json({ success: true, message: 'Team deleted' });

	} catch (err) {
		console.error('delete_team:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const add_member = async(req, res)=>{
	if(!assertFounder(req, res)) return;
	
	const { id } = req.params;
	const { user_id, role } = req.body;

	if(!mongoose.Types.ObjectId.isValid(id)){
		return res.status(400).json({ success: false, message: 'Invalid team ID' });
	}
	if(!user_id || !mongoose.Types.ObjectId.isValid(user_id)){
		return res.status(400).json({ success: false, message: 'Valid user_id is required' });
	}
	if(!role || typeof role !== 'string' || !role.trim()){
		return res.status(400).json({ success: false, message: 'role is required' });
	}

	try{
		const user = await BaseUser.findById(user_id).select('name').lean();
		if(!user){
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		const filter = {_id: id, founder_id: req.user._id, 'members.user_id': {$ne: user_id}};
		const memberObj =  {
			user_id,
			name: user.name,
			initials: getInitials(user.name),
			role: role.trim(),
			lastActive: new Date()
		};

		const doc = await Team.findOneAndUpdate(
			filter,
			{ $push: { members: memberObj } },
			{ new: true }
		);

		if(!doc){
			return res.status(404).json({ success: false, message: 'Team not found or user is already a member' });
		}

		await BaseUser.findByIdAndUpdate(user_id, {
			$addToSet: { teams: doc._id }
		});

		await pushNotification(
			user_id,
			`You were added to the team “${doc.name}” as ${role.trim()}`
		);

		return res.status(200).json({
			success: true,
			message: 'Member added',
			team: doc.toObject()
		});

	} catch(err){
		console.error('add_member:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
}


const remove_member = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const { id, userId } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid team ID' });
	}
	if (!mongoose.Types.ObjectId.isValid(userId)) {
		return res.status(400).json({ success: false, message: 'Invalid user ID' });
	}

	try {
		const team = await Team.findById(id);
		if (!team) {
			return res.status(404).json({ success: false, message: 'Team not found' });
		}

		if (team.founder_id.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'Only the team owner can remove members' });
		}

		
		if (userId === req.user._id.toString()) {
			return res.status(400).json({
				success: false,
				message: 'The team owner cannot be removed. Delete the team instead.'
			});
		}

		const before = team.members.length;
		team.members = team.members.filter(m => m.user_id.toString() !== userId);

		if (team.members.length === before) {
			return res.status(404).json({ success: false, message: 'Member not found in team' });
		}

		await team.save();

		
		await BaseUser.findByIdAndUpdate(userId, {
			$pull: { teams: team._id }
		});

		return res.status(200).json({ success: true, message: 'Member removed' });

	} catch (err) {
		console.error('remove_member:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = {
	create_team,
	list_teams,
	get_team,
	update_team,
	delete_team,
	add_member,
	remove_member
};