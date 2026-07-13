const { Founder } = require('../models/user.model.js');
const { Idea }    = require('../models/ideas.model.js');
const { Team }    = require('../models/team.model.js');
const { Portfolio } = require('../models/portfolio.model.js');


const PROFILE_SELECT =
	'name email avatar plan ' +
	'headline location about socials ' +
	'skills interests work_experience education ' +
	'expertise experience_level occupation github ' +
	'profileCompletion isVerified githubVerified walletVerified ' +
	'createdAt';


const toProfileShape = (doc) => ({
	name:              doc.name              || '',
	email:             doc.email             || '',
	avatarUrl:         doc.avatar            || '',
	plan:              doc.plan              || 'free',
	headline:          doc.headline          || '',
	location:          doc.location          || '',
	about:             doc.about             || '',
	socials: {
		linkedin: doc.socials?.linkedin || '',
		twitter:  doc.socials?.twitter  || '',
		website:  doc.socials?.website  || ''
	},
	skills:            doc.skills            || [],
	interests:         doc.interests         || [],
	experience:        doc.work_experience   || [],   
	education:         doc.education         || [],
	isVerified:        doc.isVerified        || false,
	githubVerified:    doc.githubVerified     || false,
	walletVerified:    doc.walletVerified     || false,
	profileCompletion: doc.profileCompletion || 0,
});


const computeCompletion = (doc) => {
	let score = 0;
	if (doc.name)                               score += 15;
	if (doc.about && doc.about.length > 10)     score += 20;
	if (doc.work_experience?.length > 0)        score += 20;
	if (doc.education?.length > 0)              score += 15;
	if (doc.githubVerified)                     score += 15;
	if (doc.walletVerified)                     score += 15;
	return Math.min(score, 100);
};


const assertFounder = (req, res) => {
	if (req.user.role !== 'Founder') {
		res.status(403).json({ success: false, message: 'Founder account required' });
		return false;
	}
	return true;
};


const get_profile = async (req, res) => {
	if (!assertFounder(req, res)) return;

	try {
		const doc = await Founder
			.findById(req.user._id)
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) {
			return res.status(404).json({ success: false, message: 'Profile not found' });
		}

		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('get_profile:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};




const update_profile = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const {
		name,
		headline,
		location,
		about,
		socials,
		skills,
		interests,
		experience,   
		education
	} = req.body;

	
	const updates = {};

	if (name !== undefined) {
		if (typeof name !== 'string' || !name.trim()) {
			return res.status(400).json({ success: false, message: 'name must be a non-empty string' });
		}
		updates.name = name.trim();
	}

	if (headline  !== undefined) updates.headline = String(headline).trim();
	if (location  !== undefined) updates.location = String(location).trim();
	if (about     !== undefined) updates.about    = String(about).trim();

	if (socials !== undefined) {
		if (typeof socials !== 'object' || Array.isArray(socials)) {
			return res.status(400).json({ success: false, message: 'socials must be an object' });
		}
		updates.socials = {
			linkedin: String(socials.linkedin || '').trim(),
			twitter:  String(socials.twitter  || '').trim(),
			website:  String(socials.website  || '').trim()
		};
	}

	if (skills !== undefined) {
		if (!Array.isArray(skills)) {
			return res.status(400).json({ success: false, message: 'skills must be an array' });
		}
		updates.skills = skills.map(String);
	}

	if (interests !== undefined) {
		if (!Array.isArray(interests)) {
			return res.status(400).json({ success: false, message: 'interests must be an array' });
		}
		updates.interests = interests.map(String);
	}

	if (experience !== undefined) {
		if (!Array.isArray(experience)) {
			return res.status(400).json({ success: false, message: 'experience must be an array' });
		}
		
		for (const item of experience) {
			if (!item.role || !item.company) {
				return res.status(400).json({
					success: false,
					message: 'Each experience entry requires role and company'
				});
			}
		}
		updates.work_experience = experience;
	}

	if (education !== undefined) {
		if (!Array.isArray(education)) {
			return res.status(400).json({ success: false, message: 'education must be an array' });
		}
		for (const item of education) {
			if (!item.institution || !item.degree) {
				return res.status(400).json({
					success: false,
					message: 'Each education entry requires institution and degree'
				});
			}
		}
		updates.education = education;
	}

	if (Object.keys(updates).length === 0) {
		return res.status(400).json({ success: false, message: 'No valid fields provided' });
	}

	try {
		const doc = await Founder
			.findByIdAndUpdate(
				req.user._id,
				{ $set: updates },
				{ new: true, runValidators: true }
			)
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) {
			return res.status(404).json({ success: false, message: 'Profile not found' });
		}

		
		const completion = computeCompletion(doc);
		await Founder.findByIdAndUpdate(req.user._id, { profileCompletion: completion });
		doc.profileCompletion = completion;

		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('update_profile:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};




const update_avatar = async (req, res) => {
	if (!assertFounder(req, res)) return;

	if (!req.file) {
		return res.status(400).json({ success: false, message: 'No file uploaded' });
	}

	
	
	const avatarUrl = `/uploads/avatars/${req.file.filename}`;

	try {
		await Founder.findByIdAndUpdate(
			req.user._id,
			{ avatar: avatarUrl },
			{ new: true }
		);

		return res.status(200).json({ success: true, avatarUrl });
	} catch (err) {
		console.error('update_avatar:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const get_overview = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const founder_id = req.user._id;

	try {
		
		const [ideas, teams, user, portfolioData] = await Promise.all([
			
			Idea.find({ founder_id })
				.sort({ createdAt: -1 })
				.limit(3)
				.select('title stage tags isDraft likes views')
				.lean(),

			
			Team.find({ founder_id })
				.select('members investors')
				.lean(),

			
			Founder.findById(founder_id)
				.select('notifications')
				.lean(),

			
			
			Idea.find({ founder_id })
				.select('_id')
				.lean()
				.then(async (allIdeas) => {
					if (!allIdeas.length) return { raised: 0, goal: 0 };
					const ideaIds = allIdeas.map(i => i._id);
					const portfolios = await Portfolio.find({
						'investments.idea_id': { $in: ideaIds }
					}).lean();

					let raised = 0;
					let goal   = 0;

					for (const p of portfolios) {
						for (const inv of p.investments) {
							if (ideaIds.some(id => id.toString() === inv.idea_id.toString())) {
								raised += inv.amount_released  || 0;
								goal   += inv.amount_committed || 0;
							}
						}
					}
					return { raised, goal };
				})
		]);

		
		const totalIdeas = await Idea.countDocuments({ founder_id });

		
		const memberSet = new Set();
		for (const team of teams) {
			for (const m of team.members) {
				memberSet.add(m.user_id.toString());
			}
		}

		const fundsRaisedNum = portfolioData.raised;
		const fundsRaisedStr = fundsRaisedNum > 0
			? `$${fundsRaisedNum.toLocaleString()}`
			: '$0';

		
		const ideasShaped = ideas.map(idea => {
			let status = 'Seeking';
			if (idea.isDraft) status = 'Draft';

			
			
			const ideaGoal = portfolioData.goal; 

			return {
				id:         idea._id,
				title:      idea.title,
				status,
				funding:    fundsRaisedNum > 0 ? `$${fundsRaisedNum.toLocaleString()}` : '$0',
				stage:      idea.stage,
				tags:       idea.tags || [],
				fundedPct:  ideaGoal > 0 ? Math.round((fundsRaisedNum / ideaGoal) * 100) : 0
			};
		});

		
		const teamShaped = teams.flatMap(t =>
			t.members.map(m => ({
				id:         m.user_id,
				initials:   m.initials   || '??',
				name:       m.name       || 'Team Member',
				role:       m.role       || 'Contributor',
				lastActive: m.lastActive
					? new Date(m.lastActive).toLocaleDateString()
					: 'Unknown'
			}))
		);

		return res.status(200).json({
			kpis: {
				ideas:       totalIdeas,
				teamMembers: memberSet.size,
				fundsRaised: fundsRaisedStr,
				unreadChats: user?.notifications?.length || 0
			},
			ideas:    ideasShaped,
			team:     teamShaped,
			activity: [],   
			escrow: {
				raised: portfolioData.raised,
				goal:   portfolioData.goal
			}
		});

	} catch (err) {
		console.error('get_overview:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { get_profile, update_profile, update_avatar, get_overview };
