---
name: wiki-eval
description: Use this skill to build and run eval sets against a wiki skill, log fail/fix cycles, and record real-work outcome sign-offs. Triggers on phrases like "build eval for X", "test the skill", "add a case to the eval", "the skill failed on Y", "log this fail/fix", "record outcome sign-off", "run eval set".
---

# wiki-eval

Build, run, and maintain the eval set for a wiki skill. Capture the fail/fix loop and real-work outcome verification.

## When to use

- A skill page exists at `status: draft` and needs cases to graduate to `tested`
- A skill failed on a real input — record the failure, edit the brain, re-run, log the fix
- Real outcome from running the skill needs sign-off (founder, ops, reviewer)
- Periodic regression: re-run all cases for a skill after judgment edits

## Steps

1. **Identify the skill under test.** Read `wiki/skills/<task>.md`. Verify contract.

2. **Read `wiki/SCHEMAS.md` §Eval Page** for the schema.

3. **Collect cases.** Each case needs: input, expected output, why it's hard (edge / exception / ambiguity), source (real ticket / real artifact / synthetic). Aim for 5-10 minimum, mix of easy + hard + adversarial.

4. **Run the skill against each case.** Record actual output. Mark PASS or FAIL per case.

5. **For each FAIL — run the fix loop:**
   - Diagnose root cause (judgment rule missing? knowledge page wrong? guardrail mis-scoped?)
   - Edit the brain page that caused the failure
   - Re-run the case
   - Log: failure, root cause, brain page edited, criterion changed, re-run result
   - This fail/fix log is the deliverable, not the pass rate alone

6. **Update frontmatter:** `case_count`, `pass_rate`, `last_run`.

7. **Coverage gaps.** Document what the eval set does NOT test. Honest blind spots.

8. **Outcome sign-off (when skill ran on real work).** Capture: real unit completed, verifier name + role, date, evidence link. This is the proof the skill did work a human was being paid for.

9. **Write/update page** at `wiki/evals/<skill>-cases.md` (or `wiki/<domain>/evals/<skill>-cases.md`).

10. **Append `wiki/log.md`** with operation `eval-run` (case execution), `eval-fix` (after fail/fix loop), or `outcome-signoff` (real-work verification).

## What good looks like

- Every fail has a brain edit logged. No "we'll fix it later" entries.
- Hard cases outnumber easy cases — eval set must stress the skill, not flatter it.
- Pass rate is honest, including known regressions.
- Outcome sign-off cites a real human verifier, not just "Claude said it worked".
- Coverage gaps are explicit — no false confidence.

## What to avoid

- Synthetic cases only. Real-world inputs catch failures synthetic cases miss.
- Editing a case to make it pass without editing the brain (defeats the loop).
- Single-case eval sets. One case is a test, not an eval.
- Skipping the fail/fix log. Without it, eval is just a number.
- Calling a skill `production` without outcome sign-off section filled in.

## Reference templates

- `templates/eval-template.md` — boilerplate
- 100x CAPSTONE-2 §On evals — fail/fix loop discipline
- 100x CAPSTONE-2 §On proof — real-work verification standard
