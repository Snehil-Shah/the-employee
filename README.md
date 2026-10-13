# The Employee

> Ever-growing encapsulation of an employee at your company that learns with each hire/fire/rejection.

Every company has an idea of what "great" looks like. Usually it lives in a few people's heads and drifts without anyone noticing. `the-employee` turns your ideal employee into an agent you can talk to, one that is **learned, not written** from each HR decision you make.

It can learn from written reviews from interviewers or AI-summaries of interviews (imagine integrations with tools like Kula AI, etc). As it is git-native in nature, you can do fun stuff like seeing what your ideal employee looked like before and after hiring Alice.

This is a fully Git-native agent, built on [GitAgent](https://github.com/open-gitagent/gitagent), the reference runtime of the [Open Git Agent Protocol](https://github.com/open-gitagent/opengap).

**Who does what:**

- The **curator** drafts. It can read the ideal and commit to `proposal/*` branches, nothing else.
- The **fairness reviewer** advises. It attaches a verdict to each proposal as a git note.
- A **human** decides. Only `lib/decide.mjs` writes to `main`, and no agent has a tool that reaches it.

## Adopting it

This is a template repository. Create your company's copy with **Use this template** on GitHub, or from the command line:

```sh
gh repo create <acme>/acme-employee --template <you>/the-employee --private --clone
cd acme-employee
```

Your copy starts with a single fresh commit and no traits, so its history is your company's alone: every commit after that is your ideal taking shape.

Then:

1. Add your company's non-negotiables below the base rules in `RULES.md`.
2. Feed the curator interview loops and exit notes (format in `CONVENTIONS.md`).
3. Review what it proposes and accept or decline each change with `bin/decide.mjs`.

## Running it

Requires Node 20+, git, and [GitAgent](https://github.com/open-gitagent/gitagent) (`npm install -g @open-gitagent/gitagent`). Set `ANTHROPIC_API_KEY`.

**Talk to the ideal employee.** With no traits yet, it will tell you nobody has explored it.

```sh
gitagent --dir . -p "It's 2am and production is down. What do you do?"
```

**Curate a source.** Pass one interview loop's reviews (or one set of exit notes) in the format described in `CONVENTIONS.md`. The curator proposes up to three changes on the branch `proposal/<source_id>`.

```sh
gitagent --dir agents/curator -p "source_id: reject-2026-10-backend-07
source_type: reject
role: Backend Engineer

Interviewer 1 (system design) — recommendation: no
Picked Kafka without being able to say what problem it solved over a simple queue.

Interviewer 2 (pairing) — recommendation: lean no
Reached for the heaviest tool each time; couldn't articulate the trade-off when asked."
```

**Review it for fairness.** The reviewer attaches a verdict to each proposed commit as a git note.

```sh
gitagent --dir agents/fairness -p "Review proposal reject-2026-10-backend-07"
```

**Decide.** Look at the proposal, then accept the changes you agree with. Anything you don't accept stays on its branch as a road not taken.

```sh
git log main..proposal/reject-2026-10-backend-07 -p          # proposed changes, with evidence
git log main..proposal/reject-2026-10-backend-07 --notes=fairness   # fairness verdicts
bin/decide.mjs accept <commit>
bin/decide.mjs revert <commit> "why"                          # undo an accepted change later
```

**Run the tests.** They exercise every tool, hook and decision against a throwaway copy of the repo, with no model or API key.

```sh
npm test
```
