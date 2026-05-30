# Code Memory — canon for the `mem` skill family

Canonical rules for `/mem`, `/mem-onboarding`, `/mem-explore`. This file is the
author's source of truth: each skill inlines the slices it needs at runtime.
When this canon changes, re-derive every skill in the family from it.

Communicate with the user in Russian. Write all note content (`summary`,
`body`) in Russian. Skill instructions are English — this does not change the
output language.

Saving a note needs no pre-save confirmation — a note is trivially reversible
(`update_note` / delete). Save first, then show the result; the user corrects
or drops it afterward if needed. When a confirmation *is* warranted —
`create_entity`, which adds a new shared anchor — ask in plain text, no widget;
pre-fill the answer with «да» so the user confirms in one keystroke.

## The service

Code Memory Service stores code knowledge as Markdown notes in `.memory/`.
Interact with it **only** through its MCP tools: `search`, `get_notes`,
`create_note`, `update_note`, `rename_anchor`, `create_entity`,
`list_entities`, `list_symbols_in_file`. The CLI is operated by the user
inside the service container — not callable from a skill.

Two operational modes:

- **Reading** — ambient, applies to all normal work.
- **Capture** — only on explicit `/mem` (or its onboarding/explore variants).
  Never capture proactively.

## Reading triggers

Search is gated on a **discrete event**, never on the judgment "is this a new
area?". The gate fires on:

- entry into a task or discussion branch;
- first touch of a file this session (before `Read`);
- intent to edit a symbol not yet searched this session (before `Edit`);
- the vertical shift from "what we are doing" to "which pattern or mechanism
  we use" (Architect Mode entry).

Inside an already-searched area, routine reads and edits need no re-query.
Re-check before a non-trivial edit or when a contract is in question.

## Searching

A `search` call has two paths, each with its own yield — separate calls,
never two fields of one call.

- **Anchored search** (`anchors`) is the precise, information-dense path: it
  returns the notes pinned to the exact nodes in hand. Anchors of any kind
  (`entity:`/`file:`/`symbol:`/`env:`) union by OR — pass every relevant
  anchor in one call. Use it whenever a coordinate is known.
- **Full-text search** (`query`) is the orienting path — Russian descriptive
  words, 1–2 rephrasings, BM25 over summary and body, OR by default
  (`strict: true` for AND on stemmed terms, not a phrase by position). Reach
  for it when no coordinate is in hand: boundaries still fuzzy, not all
  relevant anchors known, or the anchored search came back empty.

Mixing the two in one call is an error: the paths rank by different measures,
so the relevance cut breaks and retrieval comes back incomplete.

Each search tied to a discrete unit of work reports a one-line status in
chat: `память: нашёл N, пригодилось k` — counts only, no per-note topics.
The count cannot be written without searching — that is the point. Substance
from useful notes goes into the `## Рабочие заметки` of the current step, not the chat
status.

### Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for chosen `id`s — one call for several; returns the full body
  of each note.
- `list_symbols_in_file` for a large file before targeted `Read` — pull the
  symbol map, read the symbol range, not the whole file.
- Anchor map of a note — coordinates for reading code.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via
  `get_notes`.
- `stale` anchor — show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — flag to the user as unverified;
  verify before acting.

## Anchors

### Anchor model

Four anchor types; the set is closed.

- `file:<path>` — a source file.
- `symbol:<path>::<name>` — a top-level symbol. Method or member:
  `<path>::<Class>.<member>`.
- `entity:<Name>` — a registered domain entity (`list_entities` for the
  registry). The conceptual axis — invisible to code-level search.
- `env:<VAR>` — an environment variable, resolved against the union of all
  `.env*` files.

Connectivity is only through anchors. Anchored search is exact-match URI
equality:

- `symbol:path::Order` does not find a note anchored to
  `symbol:path::Order.cancel`;
- `file:path` does not auto-include notes anchored to symbols inside it;
- `entity:` cannot be derived from code.

To cast wide on read, pass the file, the class symbol, and each member symbol
all in one OR-call; to be found on write, anchor at every level (see Two-axis
rule).

### Two-axis rule

Every note carries anchors on **both** axes:

1. **Conceptual — `entity:`.** Every domain entity the note substantively
   concerns. Anchor it even when no file of that name was touched.
2. **Implementation — `file:` + `symbol:` (and `env:` where applicable).**
   For each substantively involved target, anchor at **every** applicable
   level at once: the containing `file:`, the class `symbol:`, the `symbol:`
   of each method or member touched. Add `env:` for every env variable the
   note substantively involves — pick it whenever semantically correct, do
   not skip it fearing a future `stale`.

Relevance decides *what* to anchor; once decided, anchor at every level. The
gate holds: a target is anchored only if the note **substantively** touches it
— a one- or two-line formal edit is not an anchor (put such cross-effects in
prose under `## Антипаттерны и Подводные камни`). Once a target passes the
gate, it is anchored at every applicable level at once — the containing
`file:`, the class `symbol:`, the `symbol:` of each member touched, plus `env:` 
for every env variable involved. There is no middle setting where a target is 
anchored at some levels but not others. A method without its class and file, or 
a symbol without its file, is under-anchored — exact-match search misses it at 
the other levels; `create_note` warns only when an entire axis is empty, so level 
completeness is on the author.

### Weights

Two independent axes, set per anchor.

- **Centrality** — `core` (main work), `supporting` (substantially related),
  `incidental` (touched, not the point).
- **Priority** — `critical` ⇔ the note holds a `## Инварианты (Must Hold)`
  section that everyone touching this anchor must see. No invariants
  section → no `critical`. `critical` is not "very `core`".

## Note body — role structure

Every note body follows one of two role-structured templates. The role
structure is part of the service contract: each section carries a specific
kind of knowledge, so a future reader (subagent or session) can navigate the
body by section name and extract what it needs. Omit any section that has
no content — do not emit an empty header.

### Notes are ADR, not a diary

A note is an **Architecture Decision Record** — a unit of code knowledge
classified by the role each piece plays for a future reader. The reader is a
subagent or a future session looking for a specific answer: "what must hold
here?", "what was considered and dropped?", "what shouldn't I do?". Write
the body for that reader.

- **Outcome, not chronology.** Capture the conclusion of the reasoning in
  its proper role, not the sequence of what was tried and when. The diff is
  in git; the session is in the work plan; the note keeps the residue.
- **One role per section.** Classify each piece of knowledge before writing
  it. Mixing roles in one section blurs the note for retrieval — a reader
  scanning «Инварианты» finds preferences, the section devalues.
- **Tone — declarative, present, terse.** "Применяется паттерн X" /
  "Инвариант: контракт Y возвращает Z". Avoid "Мы пришли к тому, что…",
  "Решено было…" — the reader needs the rule, not the journey.

### Section criteria

Pick the section by criterion, not by the wording of the source thought.

- **Контекст** — the situation that forced the decision. WHY it was needed,
  not WHAT was done. 2–3 sentences; longer means the note is over-scoped —
  split.
- **Решение** — what was chosen and the technical core of the why.
  Reversible in principle ("here we chose X, can be re-discussed"). The
  main section.
- **Альтернативы** — options considered and rejected, each with the reason.
  Prevents future loops; absence is a frequent regret on re-read.
- **Инварианты (Must Hold)** — a rule whose violation breaks behavior.
  Criterion: would code ignoring this rule produce a wrong result, a broken
  contract, or an inconsistent state? "No" → not an invariant; it belongs in
  Решение.
- **Антипаттерны и Подводные камни (Must Not)** — concrete traps: a
  tempting wrong approach, a side-effect on a distant module, a fragile
  assumption. The watch-out face of an invariant, plus what the invariant
  itself does not cover.
- **Пробелы и ограничения** — what was knowingly left open: a deferred
  concern, an accepted compromise, an unknown that did not block the
  decision.

For the Investigation template, the same mindset applies to `Подтверждено` /
`Гипотезы` / `Инварианты (подтверждённые)`: classify each piece by its
epistemic status before writing.

### Anti-swamp rule for Invariants

The `## Инварианты` section is the only basis for `critical` weight. If
every preference is written as an invariant, the section loses signal — the
same failure mode as marking ordinary decisions `critical`. Hold the line:
an invariant is a rule whose violation breaks behavior, not a stylistic
choice. A preference goes into Решение with its rationale.

### Regular note — settled decision, bug-fix, found invariant

```markdown
## Контекст
Какая проблема решалась, почему потребовалось решение. 2–3 предложения.

## Решение
Что выбрано и почему. Техническая суть.

## Альтернативы
Что рассматривали и отбросили — и почему.

## Инварианты (Must Hold)
Жёсткие правила, обязанные сохраниться при будущих правках. Наличие этой
секции — единственное основание для веса `critical`.

## Антипаттерны и Подводные камни (Must Not)
Чего делать нельзя; неочевидные side-effects на другие модули.

## Пробелы и ограничения
Что осознанно не закрыто; компромиссы; технический долг.
```

### Investigation note — exploring unfamiliar code, no final decision

```markdown
## Контекст
Что исследовалось и зачем.

## Подтверждено
Факты, подтверждённые кодом, тестами или поведением системы.

## Гипотезы
Правдоподобно, но не проверено. Явная пометка.

## Инварианты (подтверждённые)
Подтверждённо обязано быть истиной.

## Пробелы
Что не покрыто; что требует дальнейшего исследования.
```

## `summary`

An authored announce line — what makes a future agent open the note in full.
Not the slug, not the first body sentence. Carries the note in compact
`search` output and in `[[id]]` mentions.

## Note IDs and links

- `create_note` returns a short alphanumeric hash (5 chars, lowercase base36),
  generated server-side. The skill never invents an ID.
- In prose, link to another note as `[[a3f9b]]`. Where the context needs
  it, follow the link with the target's `summary`:
  `[[a3f9b]] — отказ от Redis в пользу БД`.
- `get_notes` accepts an array of these short IDs.

## `create_note` contract

- Body — one of the role-structured templates above.
- Anchors — both axes, every level (see Anchors).
- Service generates and returns the short hash ID.
- A `warning` in the response signals an empty axis or other anchor defect —
  fix and call again.

## `update_note` contract

Used when a `search` on the drafted anchors found an existing note that
already covers the same scope. Merge into the existing note rather than
duplicate.

## `rename_anchor` contract

After renaming a symbol or file in the codebase, call
`rename_anchor(old_uri, new_uri)` so note links do not go `stale`.

## Unregistered entity

`create_note` rejected on an anchor to an unknown entity → suggest
`create_entity` to the user with a short "what and why", repeat `create_note`
after confirmation.

To rename or remove a mistaken entity, edit `.memory/entities.md` directly;
the watcher reindexes on save. No MCP tool removes an entity.

## Capture discipline

Capture when:

- a decision crystallized during implementation;
- non-trivial debugging surfaced an invariant or cross-effect;
- an edge case or fragile behavior was discovered;
- a fact found by practice contradicts or supplements the docs;
- an architectural decision was made;
- unfamiliar code was investigated (use the Investigation template).

Do not capture: a rename, a typo, a trivial change without reasoning. Do not
capture a retelling of the diff — the code is in git.

`status` on capture: `current` for verified knowledge; `draft` for
in-progress onboarding chunks or notes pending review.

## Antipatterns

- Re-querying memory for every symbol during implementation once the area is
  understood.
- Expanding all `get_notes` results instead of picking by `summary`.
- Capturing a note with no reasoning, or a retelling of the diff.
- Ignoring a `stale` anchor.
- Marking an ordinary decision `critical` with no `## Инварианты` section.
- Under-anchoring: a target anchored at one level only, a method without its
  class and file, or a note missing the `entity:` axis.
- Splitting relevant anchors across separate `search` calls when a single
  OR-call would do — wastes context.
- Mixing `query` and `anchors` in one call — the paths rank by different
  measures, the relevance cut breaks, retrieval comes back incomplete.

## Cross-references

The `work` skill family owns the planning and execution workflow. Its
`core.md` carries the work-side division of labor: when each `/work-*`
command must search memory, and how its capture in `/work-step-done` and
`/work-done` calls into the `mem` family. Search and anchor discipline live
here.
