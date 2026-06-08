---
name: autopilot
description: Orchestrates a run of a ready active /work plan by spawning the atomic skills as subagents. Use only when explicitly invoked as /autopilot (optionally with @<path-to-index> and an `attended` mode word).
---

# /autopilot — orchestrate an autonomous run

Orchestration Mode. Drive a ready `active` plan to completion by spawning the atomic skills as subagents and deciding from their verdicts. This is a model-driven skill, not the harness Workflow mechanism — the loop, the branches, and the stop-brake are reasoned and run by the model.

### Orchestration Mode — spawn and decide
Spawn atomic skills as subagents and route the run from the verdicts they report; never execute stage work directly. Forbidden: writing or fixing production code, running tests, rendering screenshots, reading implementation-file contents, diagnosing a defect yourself — every heavy unit of work burns in a subagent's one-shot context, never the orchestrator's. The orchestrator reads only the index, the step file, the subagent report files, and the subagent return pointers; it writes only the `## Журнал проходов`, `## Отложенные решения`, and the final report.

Communicate with the user in Russian. Write all plan files and the report in Russian. Skill instructions are English — this does not change the output language.

## Behavior

1. Resolve the plan (Plan resolution below) and read the index in full. The plan must be `status: active` and ready — every stage authored. Planning (`/grill`, `/storyteller`, `/blueprint`) is manual and not this skill's job; autopilot runs execution only.
2. Declare the run mode (Run mode below): walk-away by default, attended on an explicit `attended` mode word (`/autopilot attended`). State it in one visible line before the loop — `режим прогона: <run mode>`.
3. Arm the keep-alive watchdog (below), then drive the run as a loop over stages. The current stage is the first without `[x]` in `## Этапы`. While one remains, run the stage cycle (below). When none remain, spawn `/finalize @<index>`, then write the final report (template below).

## Run mode

The run is **walk-away** by default, **attended** on an explicit `attended` mode word (`/autopilot attended` — a positional token, distinct from the `@<index>` argument and order-independent with it). Attended is the orchestrator's alone — it holds the channel to the human. Every spawned skill runs autonomous by channel regardless: a subagent has no human to block on, so it takes its best acceptable default and returns a pointer for anything it cannot resolve. The orchestrator passes only `@<index>`; the autonomous contract rides the spawn, not the run mode.

The mode gates how an ambiguity past Tier A is met:

- **walk-away** — the full three-tier policy runs (below). A Tier-C escalation writes its precise question to the final report's `## Эскалации (Tier C)` section, fires a host notification if the host provides one (none available → degrade to a clean stop), and halts the run.
- **attended** — Tier A resolves on the spot as ever; anything past Tier A stops at once and asks the human the precise question — no Tier-B mock, no search for a minimally acceptable default.

Resume is free: a re-invoked `/autopilot` reads the checkboxes and starts from the first stage without `[x]`. No pause state, no resume marker — the plan files already carry the position, and a fix-forward stage closes the same way a clean one does.

## Stage cycle

Per stage, spawn the atomic skills as subagents, each passed `@<index-path>` and spawned on its model (Subagent models below), and read each verdict from its report text — never re-derive it. Branch selection — the gate strategy and the development mode — lives in the spawned skills, driven by the step file's `## Стратегия гейта` and `## Режим разработки` markers; pass the index and do not pre-select. Every spawn runs under the Spawn watchdog below and kicks the keep-alive watchdog (below).

1. **Implement.** Spawn `/work` — it resolves the current stage, delegates its own `/prepare`, and writes code and tests to green in its context. Read its return pointer for any ambiguity it surfaced (Three-tier policy below).
2. **Gate.** Spawn `/validate`. Read the verdict from `plans/<prefix>/step-<NN>.md`:
   - `green` → spawn `/step-done`; the stage closes `[x]`; advance to the next stage.
   - `blocked` → Tier C: stop and escalate to a human with the report's precise reason; the gate could not run.
   - `defect` → record the pass, then Diagnose.
3. **Record the pass.** Append one line to the step file's `## Журнал проходов`: the pass number and the defect in one phrase.
4. **Stop-brake check.** Count `## Журнал проходов`; at the threshold, stop and escalate without spawning again (Stop-brake below).
5. **Diagnose.** Spawn `/diagnose`. Read the verdict from `plans/<prefix>/diagnose-<NN>.md`:
   - `located` → it carries the fix-forward coordinates.
   - `inconclusive` → Tier C: stop and escalate with the report's gap.
6. **Fix forward.** Spawn `/work` again — it fixes from the located coordinates in the current stage; a closed `[x]` stage is never rewound. Return to Gate under the same counter.

## Spawn watchdog

Every spawn in the stage cycle carries a deadline. Spawn in the background, set a wakeup for the deadline, and resume on whichever fires first.

- **Deadline.** Set it per spawn from the step's weight, and err long — a needless kill costs the abort plus the restart's context reload, a needless wait costs only minutes.
- **Resolve.** Subagent completes first → read its verdict and continue the cycle. Wakeup fires first with the report file absent → the spawn is hung: abort the subagent, record a timeout pass (one line in `## Журнал проходов`), run the Stop-brake check (below), and unless it halts, re-spawn the same step from its checkpoint.
- **Abort on the event, not a hunch.** The abort fires on the deadline with the report file absent, never on a sense the run is stuck.

## Keep-alive watchdog

A run can outlive the orchestrator's own context — it hangs or exhausts its window mid-loop, past the reach of the Spawn watchdog, which catches only a hung *subagent*. The keep-alive watchdog revives the orchestrator itself in the same session by reusing the wakeup the Spawn watchdog already arms each spawn — a kicked timer on `ScheduleWakeup`, owned by autopilot, not a separate heartbeat.

- **ARM** — at run start, before the first cycle, schedule the wakeup with the bound payload `/autopilot @<index>` (Plan resolution).
- **KICK** — every spawn re-arms it, pushing the deadline forward; while the run advances the wakeup never fires.
- **FIRE** — only on a stall. While the orchestrator lives, a fired wakeup is the Spawn watchdog resolving a hung spawn; once its context is gone, the fire re-invokes `/autopilot @<index>` fresh — and the completion guard runs first.

**Completion guard** — the first step of any wakeup re-entry. Read the bound index: the run is over when every stage is `[x]`, or `status` ≠ `active`, or `plans/<prefix>/autopilot-report.md` exists → cancel the wakeup and exit without executing. Otherwise resume from the first unchecked stage. The guard reads only existing artifacts — it stands up no resume marker and no pause state.

**Removal** — the run's terminal step cancels the wakeup as it writes the final report; a run that ends leaves no armed wakeup to fire onto a later plan.

## Subagent models

Each atomic skill is run by a `general-purpose` subagent tasked with invoking the skill's slash command (`/work @<index>`, `/validate @<index>`, …) — the skill is the command the subagent runs, not an agent type. The model is set at the spawn — no atomic skill carries one of its own. Spawn each on its fixed model:

- `/work` — Sonnet; Opus for an architecturally heavy stage, judged from the step file's scope and `## Grounding`.
- `/validate` — Sonnet.
- `/step-done` — Opus.
- `/diagnose` — Opus.
- `/finalize` — Opus.

## Stop-brake

The counter is the visible artifact, not the orchestrator's memory: each non-green pass is one line in the current step file's `## Журнал проходов` — a gate `defect` or a watchdog timeout. Before each new pass, read the section and count its lines — three passes without `green` halts the run and escalates to a human. The decision to stop is read from the file, not held in the head.

## Three-tier ambiguity policy

This is the **walk-away** policy; attended truncates it per Run mode. An ambiguity met mid-stage routes by tier; the resolver and the visible artifact differ per tier.

- **Tier A — obvious default or best practice.** Resolved by `/work` on the spot and logged in its `## Рабочие заметки`. The orchestrator does not intervene.
- **Tier B — defer behind a mock, upstream clear.** Judged by the orchestrator as the plan-holder: check the index for downstream stages that depend on the deferred decision. Safe to defer → record it in the step file's `## Отложенные решения` (the decision · the code marker · the downstream dependency) and confirm `/work` left the marker in code. The deferral must surface in the final report.
- **Tier C — not found, or the deferral threatens downstream.** Stop and escalate to a human with the precise question. A Tier-B candidate whose downstream touches a closed `[x]` stage or an unknown dependency is reclassified to Tier C.

`blocked` from `/validate` and `inconclusive` from `/diagnose` are Tier-C signals already materialized in a report — escalate, never work around them.

## Final report

Write `plans/<prefix>/autopilot-report.md` when the run ends — after `/finalize` on completion, or at the halt on a Tier-C escalation or a stop-brake. This terminal step also cancels the keep-alive watchdog (Removal, above). Nothing the run accumulated may be silently dropped — every deferred decision, every stop-brake count, and every escalation question appears.

```markdown
# Отчёт автопилота — <feature>

## Итог
<доведён до конца | остановлен на Step NN> · <этапов закрыто N из M>

## Прогон по этапам
- Step NN <slug>: <green | остановлен> · проходов: K · отчёт: plans/<prefix>/step-NN.md

## Отложенные решения (Tier B)
- <решение> · <маркер в коде> · downstream: <этап/файл> · из Step NN

## Эскалации (Tier C)
- Step NN: <точный вопрос человеку> · причина: <blocked | inconclusive | downstream-угроза>

## Счётчики стоп-крана
- Step NN: K проходов <до green | до остановки>
```

## Plan resolution

`@<path>` → that index. No argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full. The current stage is the first without `[x]` in `## Этапы`.

The bare form, resolving the single `active` plan, is a human's first invocation only. A keep-alive watchdog re-entry always carries the bound `@<index>` — the index that armed it — so a fired wakeup resumes its own run, never re-resolves `single active` onto whatever plan is active later. The bare form as a watchdog payload is forbidden.

## Antipatterns

- Reading implementation-file contents, running tests, or rendering screenshots yourself — heavy work burns in subagents, the orchestrator stays thin.
- Re-deriving a verdict instead of reading it from the report text.
- Holding the pass count in context instead of the `## Журнал проходов` line count.
- Rewinding a closed `[x]` stage to fix a cross-layer defect — the fix is forward in the current stage.
- Judging Tier B without checking the index for downstream dependents.
- Letting a deferred mock or a stop-brake escalation stay out of the final report.
- Running the Tier-B/C search under attended instead of asking the human at once past Tier A.
- Expecting a spawned subagent to block on a question — attended lives only at the orchestrator; a subagent has no human channel.
- Inventing a resume marker or a pause state — for the loop's resume or the keep-alive completion guard — instead of reading the unchecked stages and the existing index, `status`, and report artifacts.
- A bare `/autopilot` as the keep-alive wakeup payload — a fire after the run ends would re-resolve `single active` onto a different plan; the payload is always the bound `@<index>`.
- Standing up a separate heartbeat machine beside the Spawn watchdog instead of reusing its per-spawn wakeup for keep-alive.
- Passing a skill name as the agent type (`agentType: work`) instead of tasking a `general-purpose` subagent to run the skill's slash command.
- Spawning in the foreground with no deadline — a hung subagent stalls the run with no recovery.
- Aborting a spawn on a hunch the run is stuck rather than on the deadline with the report file absent.
- Re-spawning a timed-out step without recording its timeout pass — the deterministic hang loops past the stop-brake.
- Starting on a plan that is not `active`, or doing planning work — autopilot runs execution only.
