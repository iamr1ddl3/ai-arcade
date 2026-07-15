---
title: AI Content Gap & Freshness Analysis (mid-2026)
type: analysis
tags: [content, curriculum, freshness, market-research]
sources:
  - https://www.datacamp.com/blog/essential-ai-engineer-skills
  - https://www.secondtalent.com/resources/most-in-demand-ai-engineering-skills-and-salary-ranges/
  - https://www.firecrawl.dev/blog/agentic-ai-trends
  - https://turion.ai/blog/ai-agent-protocol-stack-2026/
  - https://zylos.ai/research/2026-03-26-agent-interoperability-protocols-mcp-a2a-acp-convergence/
  - https://blog.american-technology.net/context-engineering/
  - https://www.elastic.co/search-labs/blog/context-engineering-vs-prompt-engineering
  - https://www.confident-ai.com/knowledge-base/compare/best-ai-evaluation-tools-2026
  - https://zylos.ai/research/2026-02-07-small-language-models-edge-ai
  - https://huggingface.co/blog/aufklarer/ai-trends-2026-test-time-reasoning-reflective-agen
  - https://diffray.ai/blog/owasp-top-10-llm-applications/
  - https://www.practical-devsecops.com/owasp-top-10-agentic-applications/
updated: 2026-07-07
---

# AI Content Gap & Freshness Analysis (mid-2026)

TL;DR: The 20-course / 1022-lesson catalog has strong topic coverage but two weaknesses vs. the mid-2026 AI field: (1) five topics that are now table-stakes and entirely absent, and (2) six existing courses teaching a 2024/early-2025 version of a topic that has since moved. This page records the gap list so the next content decision has a grounded starting point. No content was written — user requested the research brief only.

## Context
User asked which current AI topics to add to the AIdemy catalog and to check whether existing content is still up to date ("whether it is related to MCP" — heard as "H ans"/HANS, i.e. protocols). Web research (July 2026) was run against the existing scraped catalog under `tc_scrape_output/` to separate real gaps from duplication.

## Method
- Enumerated the 20 existing courses and their module headings from the combined `.md` files.
- Ran 6 web searches covering: in-demand AI engineer skills 2026, agent protocols (MCP/A2A), context engineering, LLM/agent evaluation, reasoning models + SLM/edge AI, and AI/agent security.
- Cross-referenced each 2026 trend against existing course coverage to classify as *missing*, *stale*, or *already covered*.

## Results

### Existing coverage (already strong — do NOT duplicate)
RAG (`rag-systems`, `advanced-rag`), agents (`langchain-mastery`, `langgraph-agents`, `crewai-multi-agents`, `autogen-essentials`, `agentic-ai-patterns`), fine-tuning, `llmops-deployment`, `llm-evaluation`, `ai-safety-guardrails`, transformers, `llms-deep-dive`, ML/DL/stats/Python foundations, plus interview-prep tracks.

### A. Missing topics (candidate new courses), priority order
| # | Course | Rationale |
|---|--------|-----------|
| 1 | MCP & A2A: The Agent Protocol Stack | MCP ~97M monthly SDK downloads, 10k+ servers, donated to Linux Foundation Dec 2025; A2A v1.0 for agent-to-agent. "MCP support is now table stakes." No protocol-layer course exists. |
| 2 | Context Engineering | Named successor to prompt engineering (memory, tool outputs, retrieval, state). 89% of teams plan context-infra investment. Prompt course exists; this successor does not. |
| 3 | AI Agent Security / Red-Teaming | OWASP **Agentic** Top 10 (2026), lethal trifecta, memory poisoning, indirect prompt injection, real agent-tool CVEs. Distinct from existing guardrails course. |
| 4 | Small Language Models & Edge/On-Device AI | Phi-4, Gemma 3n, Llama 3.2 1B/3B; quantization, distillation, NPU deploy. "Model choice is now an architecture decision." Absent. |
| 5 | Reasoning Models & Test-Time Compute | o1/R1-style inference-time scaling, reasoning-effort tradeoffs. Existing LLM/transformer courses stop before this. |

### B. Existing courses needing a freshness pass (higher leverage than new courses)
| Course | Update needed |
|--------|---------------|
| `rag-systems` / `advanced-rag` | 2026 production RAG = hybrid (semantic + keyword) by default + reranking + agentic RAG. |
| `prompt-engineering-mastery` | Add "prompt = table stakes, context engineering = multiplier" framing. |
| `llm-evaluation` | Add Agent-as-a-Judge, trajectory/milestone eval, `pass^k` reliability, OpenTelemetry GenAI conventions, judge-bias caveats. |
| `llmops-deployment` | Add OpenTelemetry-based observability standard; "86–89% of agent pilots fail in production" governance angle. |
| `agentic-ai-patterns` / `langgraph-agents` | Cross-ref MCP/A2A; update multi-agent orchestration (planner/retriever/executor/evaluator split). |
| All courses (model refs) | Current production baseline: GPT-5.5, Claude Opus 4.8, Gemini 3 — replace GPT-4-era references. |

## Conclusions
- Do **B before A** — refreshing 6 owned courses is lower-effort and removes visibly-dated claims that undercut credibility; new courses are additive but bigger builds.
- Any content work must respect `raw/**` immutability: "adding content" = new source material fed through the transform→judge→generate pipeline ([[flows/content-pipeline]]), or regenerating the [[modules/arcade-transform]] layer — never editing scraped originals.
- Model-reference sweep is the cheapest single win and touches nearly every course.
- User elected research-brief-only for now; no drafting or audit performed this session.

## Related
- [[flows/content-pipeline]]
- [[modules/arcade-transform]]
- [[overview]]
