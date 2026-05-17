---
name: mem
description: Use when working on a project connected to the Code Memory Service — to find code knowledge before a task or before editing a file/symbol. Invoked explicitly as /mem to capture a decision, bug, or edge case. Teaches when to call the memory tools and how to format a capture.
---

# Code Memory — skill

The service stores code knowledge as markdown notes in `.memory/` with a derived SQLite index. This skill teaches **when** to call the tools and **how** to shape a capture — not what the service is.

Communicate with the user in Russian. Write all note content (summary, body) in Russian. Skill instructions are in English for token economy; this does not change the language of output.

This skill works two ways. **Ambiently it does reading only** — the search triggers below fire during normal work. **Capture is not ambient** — it runs only when `/mem` is invoked explicitly (by the user, or by `/work-step-done` / `/work-done`). Do not capture proactively; the plan workflow owns capture timing.

You interact with the service **only through its MCP tools** (`search`, `get_notes`, `create_note`, `update_note`, `rename_anchor`, `create_entity`, `list_entities`, `list_symbols_in_file`). The service also ships a CLI, but it is operated by the user inside the service container — it is **not callable by you**. Do not look for it or try to run it.

## When to search — triggers

- **Start of task planning** — call `list_entities` (domain map), then `search` by topic.
- **User mentioned a domain entity** — `search` with `anchors: ["entity:Name"]`.
- **Before editing a file** — `search` with `anchors: ["file:relative/path"]`.
- **Large file** — `list_symbols_in_file` first, then a targeted `Read` of the needed symbol range — not a full-file read.
- **Working with an env variable** — `search` with `anchors: ["env:VAR_NAME"]`.

### Order when breaking down a task

**entity** (broad map) → **text** (narrow by symptom) → **file** → **symbol** (precise, before editing)

Each step narrower than the last. In text search, try 1–2 rephrasings.

## Reading results

- Compact `search` list — read it whole, pick by `summary`.
- `get_notes` for the chosen `id`s — one call for several notes.
- A note's anchor map — coordinates for reading code (file, symbol, lines).
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- A `stale` anchor in output — show it to the user, do not ignore.

## Capture — what `/mem` does

`/mem` is invoked explicitly. Worth capturing: a decision that crystallized during implementation; non-trivial debugging (what was tried, why it worked); an edge case or fragile behavior; a fact found by practice that is not in the docs; an architectural decision; an investigation of unfamiliar code.

Do not capture: a rename, a typo, a trivial change without reasoning. An empty note pollutes search.

Process: draft the note; `search` for an existing note on the same anchors first — if one exists, `update_note` it instead of duplicating; otherwise `create_note` with `status: current` (the default). Show the result to the user for review, finalize after confirmation.

## Body templates

Regular note:

```
## Что сделано
Результат в 2–3 предложениях, не пересказ диффа.

## Ключевые решения и почему
Почему именно так — главная секция.

## Что пробовали и отбросили
Подходы и причины отказа. Спасает от повторения ошибок.

## Подводные камни
Gotcha'и, инварианты, cross-effects.

## Ограничения
Незакрытое, осознанные компромиссы.
```

Investigation note (unfamiliar code):

```
## Verified
Проверено кодом или подтверждено пользователем.

## Hypothesis
Правдоподобно, но не проверено. Явная, видимая пометка.

## Подводные камни / Ограничения
При наличии.
```

The templates are a guide, not a required skeleton. Omit any section that has no content — do not emit an empty header. (Trying nothing worth recording is fine; but do not skip *documenting* approaches you did try and reject.)

### summary

An authored announce line: what will make a future agent open this note in full. Not a restatement of the slug, not the first sentence of the body.

### Anchors and weights

Connectivity is **only** through anchors, and anchor search is **exact-match URI equality**. There is no hierarchy or containment:

- a search on `symbol:path::Order` does **not** find a note anchored only to `symbol:path::Order.cancel`;
- a search on `file:path` does **not** auto-include notes anchored to symbols *inside* that file;
- the conceptual level (`entity:`) cannot be derived from code at all.

So you must anchor every level you want the note found by — explicitly. Anchor only a file/symbol/entity **substantively** touched; a formal one-or-two-line edit is not an anchor — describe such cross-effects in prose under "Подводные камни".

**Required before `create_note`: anchor on both axes.** Under-anchoring is the most common capture defect — walk this checklist every time:

1. **Conceptual axis — `entity:`.** Which domain entities does this note concern? Anchor every one (`list_entities` for the registry). This is the **main search axis** — a future agent searches `entity:Name` first — and the most damaging to omit, because it is invisible to any code-level search. A note about cascade-deleting `Chunk` rows carries `entity:Chunk` even if no "chunk" file was edited.
2. **Implementation axis — `symbol:` / `file:`.** Anchor the symbol the work centers on, and anchor the **class itself**, not only its methods. If the note is about a service as a whole but you only anchored `symbol:path::Service.methodA` / `.methodB`, also anchor `symbol:path::Service` (and/or `file:path`) — otherwise a class- or file-level search misses the note entirely.
3. **`env:`** — if an env variable is involved.

A typical note carries several anchors across both axes (e.g. `entity:Order` + `entity:Cart` + `symbol:...::OrderService` + `file:...`). One or two anchors, all on the same axis, is a signal you under-anchored.

Symbol URI: `symbol:<path>::<name>` for a top-level symbol, `symbol:<path>::<Class>.<member>` for a method or member.

An `env:` anchor resolves against the **union of all `.env*` files** (`.env`, `.env.example`, …) — a variable that appears only in `.env.example` (e.g. one with a default in a config file) still resolves. Pick `env:` whenever it is the semantically correct anchor; do not skip it fearing it will go `stale`.

Weight — two axes, set deliberately **per anchor**:

- **Centrality:** `core` (main work), `supporting` (substantially related), `incidental` (touched, not the point).
- **Priority:** `critical` — the note holds an invariant everyone touching this anchor must see. Set sparingly. `critical` is not "very `core`".

## Refactoring

After renaming a symbol or file — **always** call `rename_anchor` with `old_uri` and `new_uri`, so note links do not go `stale`.

## Unregistered entity

If `create_note` is rejected for an anchor on an unknown entity — suggest `create_entity` to the user with a short "what and why", repeat `create_note` after confirmation.

To rename, re-describe, or remove a mistakenly-created entity, edit `.memory/entities.md` directly — the registry is a plain markdown file and the watcher reindexes it on save. There is no MCP tool for entity removal; do not study the service internals to find one.

## Knowledge provenance

When surfacing a note with `status: draft` or a `## Hypothesis` section — flag it explicitly to the user: "from an unverified note / a hypothesis — verify before acting".

## Antipatterns

- Calling `search` on every trivial step.
- Expanding all `get_notes` results instead of picking by `summary`.
- Capturing a note with no reasoning.
- Ignoring a `stale` anchor.
- Marking an ordinary decision `critical`.
- Under-anchoring: anchoring only to methods (not the class), or omitting `entity:` anchors — the note then never surfaces on class-, file-, or entity-level search.

For onboarding an existing project, see the `/mem-onboarding` skill.
