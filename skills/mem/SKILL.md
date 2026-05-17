---
name: mem
description: Use when working with code on a project connected to the Code Memory Service — to find code knowledge (contracts, invariants, past decisions) not visible in the code; mandatory when planning or preparing an implementation. Invoked explicitly as /mem to capture a decision, bug, or edge case. Teaches when to use the memory tools and how to format a capture.
---

# Code Memory — skill

Communicate with the user in Russian. Write all note content (summary, body) in Russian. Skill instructions are English — this does not change the output language.

The service stores code knowledge as markdown notes in `.memory/`. Interact with it **only through its MCP tools**: `search`, `get_notes`, `create_note`, `update_note`, `rename_anchor`, `create_entity`, `list_entities`, `list_symbols_in_file`. The CLI is operated by the user inside the service container — not callable by you, do not look for it.

Two modes:

- **Reading** — ambient, applies to all normal work.
- **Capture** — only on explicit `/mem` (by the user, or by `/work-step-done` / `/work-done`). Never capture proactively.

## Memory across the work phases

**Planning and preparing an implementation — search memory; it is mandatory.** Memory holds the contracts, invariants, edge cases, and past decisions that shape the work and are not visible in code or signatures. Scoping a task, reviewing a plan, choosing an approach — none is complete until memory is consulted. Search broad here — `entity:` and `file:` anchors cover the horizon so a nuance or edge case is not missed.

**Implementing — memory is on call, not a per-step gate.** Once the scope is understood, do not re-query for every symbol. The important decisions live in memory: before a non-trivial edit, or when a contract or invariant is in question, check it.

### How to search

Anchored search is exact-match. Search every level the work touches:

- task start — `list_entities`, then `search` by topic
- named domain entity — `search anchors: ["entity:Name"]`
- before editing a file — `search anchors: ["file:path"]`
- env variable — `search anchors: ["env:VAR"]`
- large file — `list_symbols_in_file`, then targeted `Read` of the symbol range, not the whole file

Order: entity → text → file → symbol. Text search — try 1–2 rephrasings.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for the chosen `id`s — one call for several.
- Anchor map of a note — coordinates for reading code.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not ignore.
- `draft` note or `## Hypothesis` section — flag to the user: unverified, verify before acting.

## Capture — `/mem`

Capture: a decision crystallized during implementation; non-trivial debugging; an edge case or fragile behavior; a fact found by practice not in the docs; an architectural decision; an investigation of unfamiliar code.

Do not capture: a rename, a typo, a trivial change without reasoning.

Process: draft the note; `search` the same anchors first — note exists → `update_note`, do not duplicate; else `create_note` with `status: current`. Show the result to the user; finalize after confirmation.

## Body templates

Omit any section with no content — do not emit an empty header. Do not skip documenting approaches tried and rejected.

Regular note:

```
## Что сделано
Результат в 2–3 предложениях, не пересказ диффа.

## Ключевые решения и почему
Почему именно так — главная секция.

## Что пробовали и отбросили
Подходы и причины отказа.

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
Правдоподобно, но не проверено. Явная пометка.

## Подводные камни / Ограничения
При наличии.
```

`summary` — an authored announce line: what makes a future agent open the note in full. Not the slug, not the first body sentence.

## Anchors

Connectivity is only through anchors; anchor search is exact-match URI equality, no hierarchy or containment:

- `symbol:path::Order` does not find a note anchored only to `symbol:path::Order.cancel`;
- `file:path` does not auto-include notes anchored to symbols inside it;
- `entity:` cannot be derived from code.

Anchor only a file/symbol/entity **substantively** touched. A formal one-or-two-line edit is not an anchor — put such cross-effects in prose under "Подводные камни".

**Substantive relevance decides *what* to anchor; once decided, anchor it at every applicable level.** The gate stays: anchor only a file/symbol/entity the note substantively concerns, not everything brushed. But each target that passes the gate must be anchored on *all* applicable levels at once — the containing `file:`, the `symbol:` of the class, and the `symbol:` of each method worked on. Anchoring a method without also anchoring its class and file, or a symbol without its file, is under-anchoring: the note then misses searches at the other levels (anchor search is exact-match, no hierarchy). A weak anchor (`incidental`) still surfaces the note; an absent one never does.

**Anchor on both axes before `create_note`** — under-anchoring is the most common defect. Checklist:

1. **Conceptual — `entity:`.** Every domain entity the note substantively concerns (`list_entities` for the registry). The main search axis, invisible to code-level search. Anchor it even if no file of that name was touched.
2. **Implementation — `symbol:` / `file:`.** For each symbol that passes the relevance gate, anchor all of its levels: the `file:`, the class `symbol:`, and every worked-on method `symbol:`. If several files are substantively involved, this applies to each.
3. **`env:`** — every env variable substantively involved.

One or two anchors, or anchors on a single axis = under-anchored. `create_note` returns a `warning` when an axis is empty — fix the anchors and call again. The warning catches only an empty axis; a target anchored at one level but not its other levels passes silently — level completeness is your responsibility, not the tool's.

Symbol URI: `symbol:<path>::<name>` for a top-level symbol, `symbol:<path>::<Class>.<member>` for a method or member. `env:` resolves against the union of all `.env*` files — pick it whenever semantically correct, do not skip it fearing `stale`.

Weight — two independent axes, set per anchor:

- **Centrality:** `core` (main work), `supporting` (substantially related), `incidental` (touched, not the point).
- **Priority:** `critical` — the note holds an invariant everyone touching this anchor must see. Set sparingly; `critical` is not "very `core`".

## Refactoring

After renaming a symbol or file — always call `rename_anchor(old_uri, new_uri)` so note links do not go `stale`.

## Unregistered entity

`create_note` rejected for an anchor on an unknown entity — suggest `create_entity` to the user with a short "what and why", repeat `create_note` after confirmation.

To rename or remove a mistaken entity — edit `.memory/entities.md` directly; the watcher reindexes on save. No MCP tool for entity removal.

## Antipatterns

- Re-querying memory for every symbol during implementation, once the scope is understood.
- Expanding all `get_notes` results instead of picking by `summary`.
- Capturing a note with no reasoning.
- Ignoring a `stale` anchor.
- Marking an ordinary decision `critical`.
- Under-anchoring: a target anchored at one level only — a method without its class and file — or no `entity:`.

For onboarding an existing project — `/mem-onboarding`.
