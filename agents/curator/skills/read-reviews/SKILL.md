---
name: read-reviews
description: How to read interviewers' reviews of a hired or rejected candidate, or an employee's exit notes, for signals that should change the ideal employee
---

# Reading a source

## What a source looks like

```
source_id: reject-2026-10-backend-07
source_type: reject            # hire | reject | exit
role: Backend Engineer

Interviewer 1 (system design) — recommendation: no
<their written assessment>

Interviewer 2 (pairing) — recommendation: lean no
<their written assessment>
```

Exit notes come as a single `Exit notes` block written by HR or the manager.
Use reviewer labels exactly as given. They are the `from` of your evidence.

## 1. Know what each kind of source can tell you

- **Hire:** the company said yes. Look for what the interviewers valued and
  why. A strong signal is something several interviewers praised that the
  ideal doesn't mention yet, or that they valued differently from how the
  ideal describes it.
- **Reject:** the company said no. Look for the behaviour that decided it.
  Rejections mostly draw **boundaries**: they sharpen a trait's signals or
  add an "It isn't" line. They rarely justify a new trait. You need **at
  least two interviewers** pointing at the same behaviour. The tool refuses
  anything less.
- **Exit:** someone left. Look for the gap between what the ideal promised
  and what the work actually needed. A strong signal is "nobody told me X
  mattered" or "we kept failing at Y".

## 2. Separate the signal from the reviewer

Interviewers disagree, and their reasons can carry their own bias. For each
candidate signal, ask:

- *Do several reviewers say it independently, in their own words?*
- *Is it about something the candidate did in the interview, or a feeling
  about them?* "Couldn't explain why they chose the queue" is behaviour. "Not
  a culture fit" or "communication wasn't there" is a feeling, and often a
  proxy.
- *Would it still be true of a different candidate?*

When the interviewers **split** (one strong yes, one no, over the same
behaviour), the ideal is probably ambiguous. Proposing a clearer trait is
often the most useful change you can make.

## 3. Decide what kind of change it is

Read the ideal with `read_ideal` first.

- **The ideal is empty or doesn't cover the signal** → `add`. Provide a
  `title`, a one-line `summary`, a first-person `meaning`, 1–5 observable
  `signals`, and optionally up to 3 `not` lines.
- **The signal sharpens, bounds or contradicts an existing trait** →
  `modify`, using its slug. Send only the fields that change. `signals` and
  `not` replace the whole list, so include the lines you're keeping.
- **A trait has proved wrong or harmful** → `remove`. This is rare and needs
  strong evidence.

## 4. Write the trait well

- `meaning`: what I do and why it matters *here*, in one paragraph and in the
  first person.
- `signals`: things an interviewer could actually observe in a loop, or a
  teammate on the job.
- `not`: the most likely misreading, so the trait doesn't get stretched.

## 5. Check before proposing

- Is every quote verbatim and labelled with its reviewer?
- For a reject, do the quotes come from at least two interviewers?
- Is every line observable behaviour, with no demographic proxy?
- Is this one of at most three changes?

## Example

The ideal has one trait, `writes-things-down`. The source is a reject:

> **Interviewer 1 (system design)**, no: "Picked Kafka without being able to
> say what problem it solved over a simple queue."
>
> **Interviewer 2 (pairing)**, lean no: "Reached for the heaviest tool each
> time; couldn't articulate the trade-off when asked."

Two interviewers independently describe the same behaviour, so it clears the
bar. Nothing in the ideal covers it, so the proposal is `add` "Chooses the
simplest thing that works", with
- summary: "Picks the simplest tool that solves the problem and can say why."
- meaning: "I choose the simplest design that meets the need, and I can explain the trade-off I made."
- signals: ["can say what a chosen tool solves that a simpler one wouldn't", "names the trade-off without being asked"]
- not: ["avoiding new technology on principle"]

Evidence: both quotes, each labelled with its interviewer.
