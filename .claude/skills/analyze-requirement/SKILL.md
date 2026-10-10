---
name: analyze-requirement
description: Analyze a requirement with the product-owner agent. Use when the user wants a requirement (passed in the prompt) turned into a goal summary, scope, and a prioritized testable feature breakdown. Delegates to the product-owner agent and blocks until EVERY open question has been answered by a human — nothing is guessed.
---

# Analyze Requirement

Turn a requirement provided in the prompt into a product analysis by delegating to the
**product-owner** agent, and make sure **every open question is answered by a human** before the
analysis is considered complete.

The requirement to analyze is whatever the user passes in the prompt (inline text, a pasted spec, a
file path, or a reference to `docs/requirement.md`). If no requirement is given, ask the user for it
before doing anything else.

The flow is always: **delegate → summarize the goal → surface open questions (in the file) → get
human answers → finalize**. Never let the product-owner guess an answer, and never proceed past open
questions on assumption.

## 1. Gather the requirement

Determine what to analyze:

- If the user pasted requirement text inline, use it verbatim.
- If the user named a file (e.g. `docs/requirement.md`) or a feature area, pass that reference
  through.
- If nothing analyzable was provided, stop and ask the user what requirement to analyze.

## 2. Delegate to the product-owner agent

Launch the **product-owner** agent (via the Agent tool, `subagent_type: "product-owner"`) with a
prompt that:

- Includes the requirement to analyze (the text or the file reference from step 1).
- Asks it to produce its `goal.md` — goal summary, scope & assumptions, and the **open questions**
  checklist — per its own instructions.
- Explicitly instructs it to **stop at the open-questions gate**: write every genuine ambiguity as a
  numbered **open-questions checklist inside `goal.md`** rather than resolving them itself or
  inventing answers. The product-owner must **not** separate the feature list or create task folders
  yet.

## 3. Summarize the goal, then point the human at the questions in the file

Before asking anything, **first give the human a concise summary of the goal** so they know what the
requirement is about — the goal statement, scope, and key assumptions the product-owner captured.
This orients the human before they weigh in on any ambiguity.

Then surface the open questions **as they are written in `goal.md`** — the questions live in the
file, and the human answers against that list. Tell the human where `goal.md` is and relay the
numbered open-questions checklist from it so they can respond question-by-question.

## 4. Get every open question answered by a human

This is the core guarantee of this skill: **all open questions must be answered by a human.**

- The human answers the numbered open questions from `goal.md` directly. Do not reformat them into
  the AskUserQuestion tool — keep them as the in-file checklist and let the human respond to the list.
- **Record each answer in `goal.md` as soon as it arrives.** Whenever the human answers one or more
  questions, have the product-owner immediately update `goal.md` — write the answer inline under the
  question and flip its box from `- [ ]` to `- [x]` — before moving on. Do this incrementally, not
  only at the end, so the human can reopen `goal.md` at any time and see which questions are still
  open. (The human need not answer all ten at once; partial answers are recorded as they come.)
- Do **not** answer any open question yourself, and do **not** let the product-owner assume a
  default. If the user's answer raises new questions, add them to the checklist in `goal.md` and ask
  those too.
- Keep going until **zero** open questions remain.

If the product-owner reports there are no open questions, confirm that explicitly with the user
before moving on.

## 5. Finalize the analysis

Once every open question has a human answer, send the answers back to the product-owner agent (same
agent, continue it via SendMessage so it keeps its context) and have it:

- Record each answer next to its question in `goal.md` and mark it resolved.
- Get the human's explicit approval of `goal.md`.
- Only then proceed with the rest of its workflow (feature list, task folders) if the user wants
  that — otherwise stop at an approved `goal.md`.

## 6. Report back

Summarize for the user: the goal, where `goal.md` was written, every open question with its
human-provided answer, and the current state (goal approved / features defined / stopped at goal).
Note anything still pending a human decision — there should be none.
