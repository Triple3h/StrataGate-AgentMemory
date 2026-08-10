# Contributing to AgentMemory

Thanks for helping make agent memory easier to inspect and reproduce.

## Before opening a change

1. Search existing issues and pull requests.
2. Keep the change focused on one memory invariant or integration boundary.
3. For semantic changes, describe a concrete conversation and the wrong behavior before proposing the new rule.

## Development

```bash
npm install
npm run check
npm test
npm run build
```

## Pull requests

A good pull request explains:

- the memory failure or developer problem;
- the invariant that should hold;
- the smallest change that enforces it;
- tests used to verify the behavior;
- any compatibility, privacy, or benchmark impact.

Do not include private conversations, API keys, provider request dumps, or benchmark data whose license does not permit redistribution.

## Evaluation changes

Scores are accepted only with enough metadata to reproduce their meaning. Include dataset scope, models, prompts, temperature, question categories, judge repetitions, memory-state provenance, completion count, and known protocol deviations.

Changing the judge, answerer, extraction model, or dataset scope creates a new protocol series. Do not append that score to an existing improvement curve without clearly separating it.
