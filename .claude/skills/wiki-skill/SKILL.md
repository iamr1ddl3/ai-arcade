---
name: wiki-skill
description: Use this skill to package a callable agent-executable task with a contract — inputs, outputs, knowledge refs, judgment refs, guardrails. Triggers on phrases like "make X callable", "package this as a skill", "agent should be able to do X", "wrap this workflow as a skill", "build a skill that scores/decides/processes Y".
---

# wiki-skill

Package an end-to-end task as an agent-callable skill with a strict contract. Output is a skill page that ties knowledge + judgment + guardrails into one executable procedure.

## When to use

- A repeating task has stabilized — knowledge + judgment + guardrails exist; need to bind them into a callable
- Building an agent loop that needs concrete tools to call
- Codifying expertise so a junior or an agent can produce expert output
- Productizing a process previously done ad-hoc by a human

## Steps

1. **Name the task narrowly.** "Score pitch deck" not "fundraising help". One skill per atomic unit of work.

2. **Read `wiki/SCHEMAS.md` §Skill Page** for the schema.

3. **Verify dependencies exist:**
   - Knowledge pages (concepts, modules, data-models, flows) the skill needs to read
   - A judgment page if the skill makes a decision or scores something
   - A guardrails page for the domain (forbidden actions, escalation rules)
   - Stub any missing dependency before writing the skill.

4. **Write the contract.** Inputs (name + type + validation), outputs (name + type + shape), side effects (none / read-only / writes), authority (what skill decides alone vs escalates), failure mode (what it returns when inputs invalid or knowledge missing). Contract is non-negotiable — agents will assume it holds.

5. **Write the procedure.** Numbered steps. Each step either loads a wiki page, applies a rule, checks a guardrail, or emits output. Procedure must reference judgment + guardrails by `[[wikilink]]`.

6. **Add a worked example.** Real input → real output. Pin down ambiguity by example.

7. **Link or stub the eval set** at `wiki/evals/<this-skill>-cases.md`. Skill without eval set is `status: draft` — no production use.

8. **Write page** at `wiki/skills/<task>.md` (or `wiki/<domain>/skills/<task>.md` for domain-scoped).

9. **Cross-link the quad** — judgment + eval + guardrails all reference this skill, and this skill references them.

10. **Append `wiki/log.md`** with operation `skill-package`.

## What good looks like

- Contract is unambiguous — an agent could call the skill from the page alone, no clarification needed.
- Procedure references `[[judgment/...]]` and `[[guardrails/...]]` explicitly, not implicitly.
- Worked example covers both happy path and one failure mode.
- Status field reflects reality: `draft` (no eval), `tested` (eval exists, passes), `production` (running against real work with sign-off).
- Skill page changes when contract changes — never silently.

## What to avoid

- Skills that wrap prose ("read knowledge page, decide carefully"). Skills must be procedures, not vibes.
- Skipping the guardrails section because "this skill is safe". All skills declare boundaries explicitly.
- Mixing two skills in one page. Split if more than one atomic unit of work.
- Inputs/outputs as natural language. Use names + types + shapes.
- Marking skills `production` before eval set passes against real cases.

## Reference templates

- `templates/skill-template.md` — boilerplate
- 100x ZenoWiki SKILL.md pattern — knowledge + judgment + reference layered into one file
