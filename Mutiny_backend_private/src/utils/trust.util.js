const { Investor } = require('../models/user.model.js');


const TRUST_WEIGHTS = {
	ndas:           3,   
	escrowReleases: 5,   
	receipts:       2,   
	history:        1,   
};


const incrementTrust = async (investorId, deltas = {}) => {
	const $inc = {};

	for (const [field, amount] of Object.entries(deltas)) {
		if (!TRUST_WEIGHTS[field]) continue;
		if (typeof amount !== 'number' || amount === 0) continue;
		$inc[`trustBreakdown.${field}`] = amount;
	}

	if (Object.keys($inc).length === 0) return;

	
	const investor = await Investor
		.findByIdAndUpdate(investorId, { $inc }, { new: true })
		.select('trust trustBreakdown')
		.lean();

	if (!investor) return;

	
	const { ndas, escrowReleases, receipts, history } = investor.trustBreakdown;
	const aggregate = Math.min(
		100,
		(ndas           || 0) * TRUST_WEIGHTS.ndas           +
		(escrowReleases || 0) * TRUST_WEIGHTS.escrowReleases +
		(receipts       || 0) * TRUST_WEIGHTS.receipts       +
		(history        || 0) * TRUST_WEIGHTS.history
	);

	await Investor.findByIdAndUpdate(investorId, { trust: aggregate });
};

module.exports = { incrementTrust, TRUST_WEIGHTS };
