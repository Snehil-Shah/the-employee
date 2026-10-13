# Traits

Each trait of the ideal employee is one file here, named by its slug:
`traits/<slug>.md`, in kebab-case. The slug is the trait's permanent id. A
trait can be retitled, but its file is never renamed, so `git log --follow`
and `git blame` follow it for its whole life.

This directory starts empty. Traits are added only through reviewed
proposals (see `../CONVENTIONS.md`). Nobody writes them by hand up front.

## Format

```markdown
---
title: Writes things down
summary: Writes decisions and their reasons where the next person will find them.
---

# Writes things down

I write the decision, the reason, and the options we rejected, so the next
person doesn't have to rebuild the context from scratch.

## You'll see it when
- a new teammate answers "why is it built this way?" from my notes
- a design review links to a written decision, not a meeting

## It isn't
- writing long documents nobody reads
```

| Part | Rule |
|---|---|
| `title` | A short name for the behaviour. Can change over time. |
| `summary` | One line, under 140 characters. It appears in the `SOUL.md` index, which is always in the agent's prompt. |
| Meaning | One first-person paragraph: what I do, and why it matters here. |
| `## You'll see it when` | 1–5 **observable** behaviours. This is what interviewers can look for. |
| `## It isn't` | 0–3 common misreadings. This keeps the trait from being stretched into something else. |

Traits describe behaviour, never identity. A trait must not refer to
demographics or to proxies for them (see `../RULES.md`).

The `## Traits` index in `SOUL.md` is generated from these files. Don't edit
it by hand.
