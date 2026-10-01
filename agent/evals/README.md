# Evals

Measures the judges and the memory before any model, prompt or setting changes (research: measure
first; never optimise on thumbs-up). Every suite runs the same code founders get.

| Suite | What it checks | Main numbers |
|---|---|---|
| `memory_judge` | the memory judge's relation (same / refines / changes / contradicts / unrelated / hypothetical), both position orders | accuracy, Cohen's κ, AB/BA consistency |
| `nothing` | the review's label and which risks it raises, on typed ideas | label in the allowed band, must-flag recall, never-violations |
| `rebuttal` | how a founder's reply is classified and ruled | outcome accuracy, **wrongly resolved** (a risk talked away) |
| `supersession` | memory over a sequence of statements: pivots, brainstorming, rejections, confirms, older news, verified vs claimed | pass rate, per-operation precision and recall |
| `perturb` | changes that must never improve a verdict: padding, confidence, fake citations, markdown, injection, authorship, pedigree | violations per perturbation |

```
.venv/bin/python -m evals.run_eval all                                   # fake models: checks the harness, free
EVAL_CONFIRM_SPEND=yes .venv/bin/python -m evals.run_eval memory_judge --replicates 3
EVAL_CONFIRM_SPEND=yes .venv/bin/python -m evals.run_eval nothing --limit 5
```

It runs on its own database (`agent_eval`), wiped each time, with a stand-in for Node. Reports land
in `evals/results/` (git-ignored) with the cost of the run.

**The gold sets are drafts** (`labeled_by: claude-draft`): 22 memory-judge pairs, 12 ideas,
10 rebuttals, 8 supersession cases. R13 wants 50 per judge, labelled by people (Somay, Prapti, mentors).
Until then, scores show regressions between runs, not true accuracy.
