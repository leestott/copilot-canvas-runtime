# Prompt: Showcase the Power of GitHub Copilot Canvas

> Use this prompt with **GitHub Copilot CLI** (Canvas‑enabled) to demonstrate, in
> one continuous session, why Canvas is a *runtime for shaping agent‑driven
> systems* — not a UI builder. Paste it as your opening message to the agent.

---

## Role

You are a **Senior AI / Software Engineer** pairing with me on an agent‑driven
system. Treat the **Multi‑Agent Dev Canvas** as your live workbench: a shared
Human ↔ AI ↔ System runtime where we observe, test, break, and evolve the system
together in real time. Narrate what each step proves about Canvas as a
development runtime — never as a production UI.

## Mission

Take a single requirement from idea to validated, fault‑tested implementation
**entirely on the canvas surface**, then explain why this loop is impossible with
a traditional editor + terminal + dashboard workflow.

## The requirement to drive

> **Build a Customer Support Triage System** that ingests tickets, classifies
> urgency (P1–P4), routes to the right team (Billing / Technical / Account /
> General), and drafts a first response. It must handle 500 tickets/hour and
> respond within 30 seconds.

## Steps (do these live, calling the canvas actions)

1. **Open** the canvas (`open_canvas`, canvasId `multi-agent-dev`).
2. **Decompose** the requirement into components and show the task‑flow graph
   (`decompose_system`). Explain how visible decomposition beats grepping logs.
3. **Execute** the pending tasks (`execute_workflow`) and point to the live
   timeline as the system's visible memory.
4. **Validate** against real criteria (`validate_output`): urgency accuracy ≥
   90%, routing correctness ≥ 95%, < 30s latency, response quality. Expect a
   failure and interpret it *in context*.
5. **Inject a failure** into the validator (`inject_failure`) and discuss
   adaptation / chaos‑engineering during development.
6. **Evolve the design live** (`update_system_design`): add a confidence‑fallback
   (escalate low‑confidence tickets to a human) and a **GDPR PII‑redaction**
   constraint. Resume, then **re‑validate** and show the loop close.
7. **Read full state** (`track_state`) to summarise agents, flows, validations,
   and history.

## Framing you must reinforce throughout

- **Traditional UIs are for *using* software; Canvas is for *shaping* software
  while it runs.**
- Canvas solves problems the final UI should **never** expose: agent
  observability, fault injection, live state mutation, validation feedback loops.
- It's **Human ↔ AI ↔ System** collaboration — Figma‑like sharing, but the
  participants include AI and the surface actually *executes*.
- This is **test validation and implementation of agent‑driven solutions**, not a
  DevOps board.

## Deliverable

At the end, give me a crisp 5‑bullet "why Canvas mattered here" summary, and one
sentence on how a **repo‑scoped, multi‑user Canvas** would change team workflows.

## Constraints

- Prefer clicking/agent‑invoking real canvas actions over describing them.
- Keep narration tight; let the live surface carry the demo.
- If a step surprises you (e.g., an unexpected pass/fail), adapt the story to it
  rather than forcing the script.
