const { Investor } = require('../models/user.model.js');


const TRUST_WEIGHTS = {
	ndas:           3,   
	escrowReleases: 5,   
	receipts:       2,   
	history:        1,   
};


// One atomic pipeline update (X-45): the counters move and the score is recomputed from them in
// the same write, so two events at once can't leave a stale score. Counters never go below 0.
const incrementTrust = async (investorId, deltas = {}) => {
	const set = {};
	for (const [field, amount] of Object.entries(deltas)) {
		if (!TRUST_WEIGHTS[field]) continue;
		if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) continue;
		const path = `trustBreakdown.${field}`;
		set[path] = { $max: [0, { $add: [{ $ifNull: [`$${path}`, 0] }, amount] }] };
	}
	if (Object.keys(set).length === 0) return;

	const score = { $min: [100, { $add: Object.entries(TRUST_WEIGHTS).map(([field, weight]) =>
		({ $multiply: [{ $ifNull: [`$trustBreakdown.${field}`, 0] }, weight] })) }] };
	await Investor.updateOne({ _id: investorId }, [{ $set: set }, { $set: { trust: score } }], { updatePipeline: true });
};

module.exports = { incrementTrust, TRUST_WEIGHTS };
