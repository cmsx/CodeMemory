# Code Memory — shared core

Shared discipline for the `mem` skill family (`/mem`, `/mem-onboarding`). Each entry point reads this once per session before its job; skip if already in context.

Communicate with the user in Russian. Write all note content (summary, body) in Russian. Skill instructions are English — this does not change the output language.

When asking the user to confirm — saving a note, `create_entity` — ask in plain text, no widget; pre-fill the answer with «да» so the user confirms in one keystroke.

## The service

The Code Memory Service stores code knowledge as markdown notes in `.memory/`. Interact with it **only through its MCP tools**: `search`, `get_notes`, `create_note`, `update_note`, `rename_anchor`, `create_entity`, `list_entities`, `list_symbols_in_file`. The CLI is operated by the user inside the service container — not callable by you, do not look for it.

Two modes:

- **Reading** — ambient, applies to all normal work. Covered below.
- **Capture** — only on explicit `/mem`. Never capture proactively. See the `mem` skill.

## Reading

Planning or preparing an implementation — `search` memory; mandatory. It holds contracts, invariants, edge cases, decisions not visible in code. Search broad — `entity:` and `file:` anchors.

Memory precedes file reading — it is the map of which files carry context. Starting to study or plan an area by reading its code, with no prior memory search for that area, is a failure: memory exists to spare exactly that blind reading. This is a gate on *entering* an area, not on every `Read` — routine reads and edits inside an already-searched area need no re-query (see Implementing below).

The search trigger is a discrete unit of work, never the judgment "a new area": the first touch of a given file or symbol, and the entry into each task or discussion branch. Search at that point, before `grep` and code reading.

Implementing — memory is on call, not a per-step gate. Re-check before a non-trivial edit or when a contract is in question; do not re-query for every symbol.

### How to search

Anchored search is exact-match. Search every level the work touches, as separate calls:

- task start — `list_entities`, then `search` by topic
- named domain entity — `search anchors: ["entity:Name"]`
- before editing a file — `search anchors: ["file:path"]`
- env variable — `search anchors: ["env:VAR"]`
- large file — `list_symbols_in_file`, then targeted `Read` of the symbol range, not the whole file

Order: entity → text → file → symbol. Do not collapse stages into one mixed call. Text search — try 1–2 rephrasings.

Text `query` — notes are written in Russian, so write the descriptive words of the query in Russian; a query in a different language than the note prose finds nothing. Literal code identifiers (class, function, variable names) stay as written in the code. Russian terms are stemmed and prefix-matched on the search side — write natural words, do not hand-pick roots. Terms combine as AND by default — keep the query to the few key words. Unsure of the exact wording (fuzzy recall) → `any_term: true` to match any term; BM25 still ranks the densest hit first.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for the chosen `id`s — one call for several.
- Anchor map of a note — coordinates for reading code.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not ignore.
- `draft` note or `## Hypothesis` section — flag to the user: unverified, verify before acting.

## Anchors

Four anchor types — the set is closed; consider every one before `create_note`, none is optional to weigh:

- `file:<path>` — a source file.
- `symbol:<path>::<name>` — a top-level symbol; `<path>::<Class>.<member>` for a method or member.
- `entity:<Name>` — a registered domain entity (`list_entities` for the registry).
- `env:<VAR>` — an environment variable, resolved against the union of all `.env*` files.

Connectivity is only through anchors; anchor search is exact-match URI equality, no hierarchy or containment:

- `symbol:path::Order` does not find a note anchored only to `symbol:path::Order.cancel`;
- `file:path` does not auto-include notes anchored to symbols inside it;
- `entity:` cannot be derived from code.

Anchor only what the note **substantively** touches. A formal one-or-two-line edit is not an anchor — put such cross-effects in prose under "Подводные камни".

Once a target passes the gate, anchor it at **every** applicable level at once — the containing `file:`, the class `symbol:`, the `symbol:` of each method worked on. A method without its class and file, or a symbol without its file, is under-anchored: anchor search is exact-match with no hierarchy, so the note misses searches at the other levels.

Before `create_note`, anchor on both axes — checklist:

1. **Conceptual — `entity:`.** Every domain entity the note substantively concerns (`list_entities` for the registry). The main search axis, invisible to code-level search. Anchor it even if no file of that name was touched.
2. **Implementation — `symbol:` / `file:`.** For each symbol that passes the relevance gate, anchor all of its levels: the `file:`, the class `symbol:`, and every worked-on method `symbol:`. Applies to each substantively involved file.
3. **`env:`** — every env variable substantively involved. Pick it whenever semantically correct; do not skip it fearing a future `stale`.

One or two anchors, or anchors on a single axis = under-anchored. `create_note` returns a `warning` when an axis is empty — fix the anchors and call again. The warning catches only an empty axis; a target anchored at one level but not its others passes silently — level completeness is your responsibility.

Weight — two independent axes, set per anchor:

- **Centrality:** `core` (main work), `supporting` (substantially related), `incidental` (touched, not the point).
- **Priority:** `critical` — the note holds an invariant everyone touching this anchor must see. Set sparingly; `critical` is not "very `core`".

## Note links

`[[id]]` in prose links to another note by its **id** — only an id resolves via `get_notes`.

## Refactoring

After renaming a symbol or file — always call `rename_anchor(old_uri, new_uri)` so note links do not go `stale`.

## Unregistered entity

`create_note` rejected for an anchor on an unknown entity — suggest `create_entity` to the user with a short "what and why", repeat `create_note` after confirmation.

To rename or remove a mistaken entity — edit `.memory/entities.md` directly; the watcher reindexes on save. No MCP tool for entity removal.

## Antipatterns

- Collapsing the entity → text → file → symbol stages into one mixed `search` call.
- Re-querying memory for every symbol during implementation, once the scope is understood.
- Expanding all `get_notes` results instead of picking by `summary`.
- Capturing a note with no reasoning.
- Ignoring a `stale` anchor.
- Marking an ordinary decision `critical`.
- Under-anchoring: a target anchored at one level only — a method without its class and file — or no `entity:`.
