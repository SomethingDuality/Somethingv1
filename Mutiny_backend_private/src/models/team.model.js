const mongoose = require('mongoose');





const memberSchema = new mongoose.Schema({
	user_id: {
		type:     mongoose.Schema.Types.ObjectId,
		ref:      'BaseUser',
		required: true
	},
	name:       { type: String, default: '' },    
	initials:   { type: String, default: '' },    
	role:       { type: String, default: '' },    
	lastActive: { type: Date,   default: Date.now }
}, { _id: false });


const teamSchema = new mongoose.Schema({
	
	idea_id: {
		type:     mongoose.Schema.Types.ObjectId,
		ref:      'Idea',
		required: true
	},

	
	founder_id: {
		type:     mongoose.Schema.Types.ObjectId,
		ref:      'Founder',
		required: true
	},

	
	name: { type: String, default: '' },

	
	members: [memberSchema],

	
	investors: [{
		type: mongoose.Schema.Types.ObjectId,
		ref:  'Investor'
	}]
}, { timestamps: true });


teamSchema.index({ idea_id:    1 });   
teamSchema.index({ founder_id: 1 });   

const Team = mongoose.model('Team', teamSchema);

module.exports = { Team };
