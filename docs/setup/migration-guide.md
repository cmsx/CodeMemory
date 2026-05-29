# Migrating a consumer project to CodeMemory 2.0

You are an LLM running inside a project that already uses the **old** Code
Memory skill corpus and an old `.memory/` note store. This document is your
single entry point for the migration: follow it top to bottom to bring the
project to **CodeMemory 2.0** — new MCP contracts, role-structured notes, the
new skill set, and updated grounding triggers.

The instruction prose here is English (it drives you). Note content, section
names, and examples are Russian — that is the artifact language and does not
change. Communicate with the user in Russian.

Work in this order; later steps depend on earlier ones:

1. Service contract changes — understand what moved.
2. Switch the skill corpus.
3. Update the project's `CLAUDE.md` / `docs/CLAUDE.md` triggers.
4. Migrate existing notes (dry-run first, then the rest).

Migration of notes is the only destructive step. Run the dry-run in step 4
before touching the full corpus.

---

## 1. What changed in the service contracts

Three contract changes. Canon for each lives in the spec — read the referenced
file when you need the full rule, not just the summary.

### 1.1. Note IDs — short server-generated hash

- **Old:** long date-slug IDs, e.g. `2025-11-03-redis-vs-db-for-jobs`.
- **New:** 5-character base36 hash, e.g. `a3f9b`, **generated server-side**.
  `create_note` returns the id; you never invent or pass one.
- Links are `[[a3f9b]]`; `get_notes` takes arrays of these short ids.
- Canon: `specs/02-data-model.md`, `specs/05-interfaces.md` (`create_note`).
- **Compatibility:** the service's `parseNote` is tolerant of the id format
  (it only checks `id === filename`, no format regex). Old date-slug notes
  therefore still load and are searchable — you can read them to migrate them.
  New ids are forced only at generation time.

### 1.2. Search — OR by default, single mixed call

- **Old:** one `search` call per anchor, staged in the order
  `entity: → text → file: → symbol:`; text `query` was AND by default with
  `any_term: true` to widen to OR.
- **New:**
  - Anchors are **OR** by default. Pass every relevant anchor of any kind in
    **one** call — the result is their union. Staging is gone.
  - `query` text is **OR** over keywords by default. `strict: true` switches to
    AND (all terms required). It is AND, **not** an exact phrase — FTS5 does not
    match prefixed tokens inside a phrase.
  - The `any_term` flag is **removed** (OR is now the default — `any_term` has
    no meaning).
  - `query` and `anchors` remain separate axes — never pass both in one call.
- Canon: `specs/03-search-and-retrieval.md`,
  `specs/05-interfaces.md` (`search` contract).

### 1.3. Note body — role structure (ADR)

The note body is now a closed set of canonical section names, classified by the
**role** each piece of knowledge plays for a future reader (an ADR, not a
diary). This is part of the service contract via the `/mem` templates.

- Canon: `specs/04-note-authoring.md` (role structure + body templates),
  `specs/02-data-model.md` (body as part of the service contract).
- The full old→new mapping and classification criteria are in step 4 below.

---

## 2. Switch the skill corpus

The skills live in the project's `.claude/skills/`. The switch is atomic:
replace the whole tree with the 2.0 corpus in one operation.

**2.0 corpus (11 skills):** `mem`, `mem-explore` *(new)*, `mem-onboarding`,
`storyteller` *(new)*, `work`, `work-done`, `work-grill`, `work-plan`,
`work-prime`, `work-step-done`, `work-update`.

**Old corpus (9 skills):** `mem`, `mem-onboarding`, `work`, `work-done`,
`work-grill`, `work-plan`, `work-prime`, `work-step-done`, `work-update`.

Steps:

1. Delete every old skill directory under `.claude/skills/`.
2. Install the 2.0 corpus — copy each skill directory from the source `skills/`.
3. New since the old corpus: `mem-explore` (emergency drift-recovery dashboard)
   and `storyteller` (System-Aware User Stories). All other skills are rewritten
   — install the new version, do not keep the old one.

**Do not** carry over the old `core.md` priming pattern. In 2.0 skills are
self-contained and **do not read `core.md` at runtime** — `core.md` is author
canon only. Any project instruction telling the model to "read the `mem`/`work`
`core.md` once per session" is now wrong; remove it (see step 3).

---

## 3. Update the project's grounding triggers

The project's `CLAUDE.md` and `docs/CLAUDE.md` carry Code-Memory trigger blocks
written for the old staged search. Find and replace them.

Grep both files (and any other instruction file the project loads) for the
stale wording:

- `any_term`
- "separate `search` call per anchor" / "per stage"
- the staged order "entity → text → file → symbol"
- "read … `core.md` first" / "once per session"

Replace the trigger block with the following (English — this is a `CLAUDE.md`
artifact that drives the model):

```markdown
## Code Memory — reading triggers

Reading memory is ambient: it holds contracts, invariants, edge cases, and
decisions not visible in the code. Search an area before reading its code, not
after.

ALWAYS `search` Code Memory on the trigger below, before the listed action:

- Task or discussion branch starts → `list_entities`, then
  `search { query: "<topic in Russian>" }`.
- First touch of a file this session → `search { anchors: ["file:<path>"] }`
  before `Read`.
- Editing a symbol not yet searched this session →
  `search { anchors: ["file:<path>", "symbol:<path>::<Name>"] }` before `Edit`.
- Entering a `/work` sub-task → `search` its entities and files.

The trigger is the discrete event, not the judgment "is this a new area?".

Search semantics:
- Anchors are OR by default — pass every relevant anchor (all levels:
  `file:` + class `symbol:` + member `symbol:` + `env:`) in ONE call; the
  result is their union. No per-anchor staging.
- `query` is OR over keywords by default; add `strict: true` for AND (all
  terms required, not an exact phrase).
- `query` and `anchors` are separate axes — never pass both in one call.
- Write Russian descriptive words in `query` (notes are Russian); keep code
  identifiers verbatim.
```

Adjust anchor-path examples to the project's real layout. Remove any leftover
sentence pointing at `core.md`.

---

## 4. Migrate existing notes

Goal: every note in `.memory/` ends up with a short id, a role-structured body,
and intact `[[id]]` cross-links. Notes whose anchors and weights are still
correct keep them — anchoring rules did not change.

**Access constraint.** The project denies reading and writing `.memory/`
directly (settings). Do every step through MCP — enumerate with `search`, read
with `get_notes`, write with `create_note` / `update_note`. The **only**
filesystem touch is the final bulk `rm` of the old note files (4.4): there is no
`delete_note` MCP tool and notes cannot be edited on disk, so removal is one
explicit `rm` command and nothing else reaches `.memory/` directly.

### 4.0. Enumerate the corpus (via MCP)

Reading `.memory/` is denied, so list the notes through the service, not the
filesystem: `search { match_all: true, include_archived: true, include_drafts: true }`
returns every note's `id` + `summary` compactly (`match_all` is the enumeration
parameter the onboarding flow uses). Then `get_notes` the ids in batches to pull
each body and anchor set. This id list is also the seed of the `old → new` map.

### 4.0.1. Dry-run first (mandatory)

Pick **5** representative notes — include at least one regular note, one
investigation note, and one note that links to another via `[[old-id]]`. Run
the full algorithm (4.1–4.4) on just these five, and in 4.4 `rm` **only those
five** old files by their exact ids (never a glob during the dry-run — a glob
would sweep the rest of the corpus). Validate with the checklist in 4.5. Only
after the dry-run is clean, run the rest.

### 4.1. Transform each note's body

Parse the old body into its `##` sections and re-classify each piece by **role**
(not by the old header's wording). Map:

**Regular note**

| Old section | New section | Rule |
|---|---|---|
| `## Что сделано` | *(dropped)* | A retelling of the result. The `summary` field already carries "what". If it states the *problem/why*, lift that sentence into `## Контекст`; otherwise drop it. |
| `## Ключевые решения и почему` | `## Решение` | The chosen approach and the technical core of why. |
| `## Что пробовали и отбросили` | `## Альтернативы` | Options rejected, each with its reason. |
| `## Подводные камни` | **split** → `## Инварианты (Must Hold)` and `## Антипаттерны и Подводные камни (Must Not)` | Classify each bullet by the criterion below. |
| `## Ограничения` | `## Пробелы и ограничения` | Knowingly-deferred concerns, accepted compromises, tech debt. |

**Splitting `## Подводные камни`** — apply the invariant criterion per bullet:

- **Инвариант (Must Hold)** — a rule whose violation breaks behavior: would code
  ignoring it produce a wrong result, a broken contract, or an inconsistent
  state? Yes → `## Инварианты (Must Hold)`.
- Otherwise (a tempting wrong approach, a side-effect on a distant module, a
  fragile assumption, a gotcha) → `## Антипаттерны и Подводные камни (Must Not)`.

A bullet that is merely a preference with rationale is neither — fold it into
`## Решение`.

**Investigation note**

| Old section | New section | Rule |
|---|---|---|
| `## Verified` | `## Подтверждено` | Facts confirmed by code, tests, behavior. |
| `## Hypothesis` | `## Гипотезы` | Plausible, unproven — keep the explicit flag. |
| `## Подводные камни / Ограничения` | **split** → `## Инварианты (подтверждённые)` and `## Пробелы` | Confirmed must-hold facts → `Инварианты (подтверждённые)`; the rest (unknowns, deferred) → `Пробелы`. |

**Both templates need `## Контекст`, which the old body lacked.** Synthesize a
2–3 sentence framing (WHY this knowledge was needed) from the note's `summary`
and the dropped `## Что сделано`. **Do not invent facts** — if the existing
material gives nothing, write the minimal framing the summary already implies and
no more.

Rules carried from the new canon (`specs/04-note-authoring.md`):

- One role per section. Omit any section with no content (no empty headers).
- Tone: declarative, present, terse ("Применяется паттерн X"), not narrative
  ("мы пришли к тому, что…").
- `## Альтернативы` is the one section worth preserving even if thin — it
  prevents re-walking rejected approaches.

### 4.2. Re-check anchors and weights

Anchoring rules are unchanged (`specs/04-note-authoring.md` "Якоря и веса"),
so keep existing anchors and weights — but verify two things while you have the
note open:

- Both axes present: `entity:` (conceptual) **and** `file:`/`symbol:`/`env:`
  (implementation). A note on a single axis is under-anchored — fix it.
- `critical` priority is justified **only** by a `## Инварианты` section. If
  splitting `## Подводные камни` produced a real invariant, the note may now
  warrant `critical`; if it produced none, drop any stale `critical`.

### 4.3. Regenerate ids and build the old→new map

`create_note` is **not** idempotent by id (the id is server-generated and
random), and `update_note` cannot change a note's id. So a new short id requires
re-creating the note:

**Bypass the `/mem` dedup discipline here.** Do not run migration through `/mem`,
and do not search-before-create. `/mem` step 5 searches the drafted anchors and,
on a same-scope hit, routes to `update_note`/merge instead of creating — and
since the migrated note keeps the old note's anchors (4.2) and the old note is
still on disk until the final `rm` (4.4), that search would find the old twin
and suppress the new note (no fresh id → migration stalls). The temporary
old+new twin is intentional; the service itself does not dedup (`create_note`
only guards hash collisions). Call `create_note` directly and unconditionally.

1. For each note, call `create_note` with the transformed body (4.1) and the
   verified anchors/weights (4.2). Capture the returned short id. Note that
   `create_note` stamps `created`/`updated` with today — the original creation
   date is not preserved; this is accepted (the date in the old id carried no
   value, which is why it was dropped).
2. Record the pair `old-id → new-id` in a mapping table you hold for the whole
   run. **Do not delete old notes yet** — links still point at old ids, and the
   map is what the final `rm` is built from (4.4).

If `create_note` rejects an anchor on an unregistered entity, surface it to the
user with a short "what and why" and `create_entity` after confirmation, then
retry — same as normal `/mem`.

### 4.4. Rewrite cross-links, then delete old notes

Do this only after **all** new notes exist and the full `old-id → new-id` map is
complete:

1. Rewrite links in the **new** notes: for each new note whose body contains a
   `[[old-id]]`, call `update_note` with the body where every `[[old-id]]` is
   replaced by `[[new-id]]` from the map. Preserve any trailing `— summary`
   annotation. (Notes are edited through MCP, not on disk — `.memory/` is
   write-denied.)
2. Rewrite links in the plans: in every file under `plans/` (a normal repo
   path, editable directly), replace each `[[old-id]]` with `[[new-id]]`.
3. Verify no `[[old-id]]` remains: grep `plans/`, and re-pull the new notes via
   `get_notes` to confirm their bodies are clean.
4. Delete the old notes with **one** `rm`, built from the exact old ids in the
   map — not a glob:

   ```sh
   rm .memory/notes/<old-id-1>.md .memory/notes/<old-id-2>.md …
   ```

   Build the argument list from the `old → new` map you already hold. Use the
   exact ids, not a pattern like `.memory/notes/2026-*.md`: `.memory/` is
   read-denied, so a glob cannot be `ls`-verified before it runs, and a blind
   glob risks matching more than intended. The exact-id list is collision-proof
   and needs no inspection — every legacy id in it came from MCP enumeration
   (4.0), and new ids (5-char base36) are never in `.memory/notes/` under a
   legacy name. After the `rm`, the memory watcher's `unlink` events trigger
   `reconcileNotes`, which prunes the deleted ids from the index automatically —
   no manual reindex.

### 4.5. Validation checklist (run after the dry-run, and after the full run)

- [ ] Every new note body uses only canonical section names; no empty headers.
- [ ] `## Подводные камни` bullets landed in `Инварианты` vs `Антипаттерны` by
      the invariant criterion, not copied wholesale into one bucket.
- [ ] Each note carries both anchor axes; `critical` only where a `## Инварианты`
      section exists.
- [ ] Every new id resolves via `get_notes`.
- [ ] No `[[old-id]]` reference remains in any note or plan (grep is clean).
- [ ] Old note files are deleted only after links were rewritten.
- [ ] The `rm` argument list was built from the exact old ids in the map, not a
      glob.
- [ ] After the `rm`, `get_notes` on an old id returns nothing (the watcher
      pruned it) and a `search` for the topic returns the **new** note.

### 4.6. Known migration pitfalls

- **Missing `## Контекст`.** Old notes have none; the temptation is to invent a
  backstory. Derive from existing material only (4.1).
- **`## Подводные камни` swept into one bucket.** Per-bullet classification is
  required — invariants and antipatterns serve different readers, and
  `Инварианты` gates `critical`.
- **Link rewrite ordering.** Rewriting `[[old-id]]` before the full map exists
  leaves dangling links. Create all notes first, then rewrite (4.4).
- **Expecting `create_note` to reuse the old id.** It cannot — the id is
  server-generated. The old→new map is the only bridge.
- **Letting `/mem` dedup suppress the new note.** Migrating through `/mem` (or
  searching anchors before `create_note`) finds the still-present old twin and
  merges into it instead of creating a fresh-id note. Bypass `/mem`; create
  unconditionally (4.3).
- **Deleting old notes with a blind glob.** `.memory/` is read-denied, so a
  pattern like `2026-*.md` cannot be `ls`-verified and may sweep more than
  intended. Build the `rm` from the exact old-id list in the map (4.4).
- **Trying to edit notes on disk.** `.memory/` is write-denied; the only allowed
  filesystem op against it is the final `rm`. Body and link edits go through
  `update_note`.
- **Leaving stale trigger wording.** Notes migrate cleanly but the model keeps
  staged-searching because `CLAUDE.md` was not updated (step 3).
