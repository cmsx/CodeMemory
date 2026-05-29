
## Code Memory — reading triggers

Read `skills/mem/core.md` first — it defines the subject area: anchors, query
language, search staging, and how to read results. The triggers below assume
that knowledge.

ALWAYS `search` Code Memory on the trigger below, before the listed action:

- Task or discussion branch starts → `list_entities` + `search` by topic in Russian.
- First touch of a file this session → `search anchors: ["file:<path>"]` before `Read`.
- Editing a symbol not yet searched this session → `search anchors: ["symbol:<path>::<Name>"]` before `Edit`.
- Entering a `/work` sub-task → `search` its area.

Do not gate any of the above on the judgement "is this a new area?" — the
trigger is the discrete event.

ALWAYS make a separate `search` call per anchor and per stage; order
`entity:` → text → `file:` → `symbol:`.
Do not pass `query` and `anchors` to the same call.
Do not pack multiple anchors into one call.
