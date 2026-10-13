# Conventions

These are the contract between the agents, the humans who review their work,
and any interface built on top of this repo. The tool scripts and
`lib/decide.mjs` enforce them, and `test/tools.test.mjs` checks them.

## The ideal

- `main` is the approved ideal. Nothing lands there except through a human.
- The ideal starts **unexplored**: the base framework defines no traits. It
  only defines how traits are written, proposed, reviewed and decided.
- Each trait is one file, `traits/<slug>.md`. The format is in
  `traits/README.md`. The slug is permanent: titles can change, file names
  don't.
- `SOUL.md` is who the ideal is, plus a `## Traits` index with one line per
  trait. The index is **generated** from `traits/` (`writeIndex` in
  `lib/ideal.mjs`) and is never edited by hand. It's the only part of the
  ideal in the agent's system prompt. The ideal reads full trait definitions
  on demand with its `read_trait` tool.
- `RULES.md` holds the non-negotiables. A company appends its own rules below
  the base ones and doesn't remove them.

## Sources

The ideal learns from written judgments, never from recordings or
transcripts. A source is one of:

| `source_type` | What it is | Written by |
|---|---|---|
| `hire` | Every interviewer's review of a candidate the company hired | Interviewers |
| `reject` | Every interviewer's review of a candidate the company turned down | Interviewers |
| `exit` | Notes from an employee's exit conversation | HR or the manager |

The curator receives a source in its prompt, in this form:

```
source_id: reject-2026-10-backend-07
source_type: reject
role: Backend Engineer

Interviewer 1 (system design) — recommendation: no
<assessment>

Interviewer 2 (pairing) — recommendation: lean no
<assessment>
```

Reviewers are labelled by position and focus (`Interviewer 2 (pairing)`),
not by name. A change from a `reject` needs evidence from at least two
different interviewers. Rejection reasons are where hiring bias
concentrates, so one person's "no" never reshapes the ideal on its own.

## Proposals

- One source gives one branch: `proposal/<source-id>`, cut from `main`.
- One change gives one commit, with at most three per source. The proposal is
  decided as a whole, like a pull request.
- Agents write proposals in a worktree under `.proposals/<source-id>`, never
  in the main checkout.
- Each proposal commit is authored by the curator: `Curator (the-employee)
  <curator@the-employee.local>`, unless the host sets `THE_EMPLOYEE_GIT_NAME`
  and `THE_EMPLOYEE_GIT_EMAIL` (for example, to a GitHub App's bot so GitHub
  shows the app). Its message is a subject line (`Add trait:
  …`, `Refine trait: …`, `Remove trait: …`) and a rationale paragraph,
  followed by these trailers:

  | Trailer | Meaning |
  |---|---|
  | `Source` | Source id. The only link back to the candidate or employee. |
  | `Source-Type` | `hire`, `reject` or `exit` |
  | `Change` | `add`, `modify` or `remove` |
  | `Trait` | Slug of the trait changed |
  | `Evidence` | `<reviewer label>: "<verbatim quote>"`, repeated once per quote (1–3) |
  | `Proposed-By` | `curator` |

## Reviews

- The fairness reviewer attaches its verdict as a git note under
  `refs/notes/fairness`, as JSON: `{ verdict: "clear" | "flagged", summary,
  concerns: [{ term, why, suggestion }], reviewed_at }`. Notes leave the commit
  hash unchanged, so a review never rewrites the proposal it describes.

## Decisions (human only)

All decisions go through `lib/decide.mjs` (or `bin/decide.mjs` on the command
line). No agent has a tool that reaches them.

- **Accept a proposal:** it is squashed onto `main` as one commit by the
  approver, titled by the host (for example `HIRED: Alice (Engineering
  Manager)`), listing its changes and carrying `Source` and `Decision:
  accepted` trailers. `main` stays a clean list of decisions; each change's
  rationale and evidence stay in the proposal's own commits on its branch.
  Proposals can be accepted in any order: a stale branch first catches up with
  `main` (`catchUp`), with the generated index regenerated rather than merged.
- **Decline a proposal:** leave its branch unmerged. Proposal branches are
  never deleted, so they serve as a record of the roads not taken.
- **Undo an accepted proposal:** revert its commit on `main`, with a reason
  (`Decision: reverted`).

## Privacy

Full reviews and exit notes never enter this repo. They are passed to the
curator in its prompt and not stored. Only short evidence quotes (under 280
characters each), reviewer labels and the source id are kept. Nothing in the
repo names a candidate, an employee or an interviewer.
