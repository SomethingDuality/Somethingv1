// Pacing rules for the Something box. Starting values, to be tuned with real usage.
module.exports = {
	DAILY_CAP: 1,                 // unprompted questions per local day
	JIT_DAILY_CAP: 3,             // just-in-time questions per local day
	JIT_PAUSED_CAP: 1,            // just-in-time questions per day while the box is paused
	SKIP_SNOOZE_DAYS: 14,         // first "skip" snooze; doubles each time
	SKIP_SNOOZE_MAX_DAYS: 90,
	NEVER_AFTER_SKIPS: 3,         // a question skipped this many times is retired
	PAUSE_AFTER_CONSECUTIVE: 3,   // skips in a row before the whole box pauses
	PAUSE_DAYS: 3,                // first pause; doubles for each further skip
	PAUSE_MAX_DAYS: 30,
	IDEA_SCOPE_LIMIT: 3,          // idea questions cover the founder's most recent ideas
};
