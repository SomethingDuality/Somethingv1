const { emit } = require('../events/index.js');

// Thin, named wrappers kept for existing callers. Each keys by the entity it is about,
// so per-entity ordering holds (they used to key by event type).

const publishIdeaCreated = (p) => emit('idea.created', p.ideaId, p);
const publishIdeaUpdated = (p) => emit('idea.updated', p.ideaId, p);
const publishIdeaDeleted = (p) => emit('idea.deleted', p.ideaId, p);

const publishInvestmentCommitted = (p) => emit('investment.committed', p.ideaId, p);
const publishInvestmentReleased  = (p) => emit('investment.released',  p.ideaId, p);

module.exports = {
    publishIdeaCreated,
    publishIdeaUpdated,
    publishIdeaDeleted,
    publishInvestmentCommitted,
    publishInvestmentReleased,
};
