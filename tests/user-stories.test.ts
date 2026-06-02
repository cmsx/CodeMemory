import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startHarness, writeFixtureNote, type Harness } from "./helpers/mcp-harness.js";

// ── Story 01 — возврат к давно тронутой области ──────────────────────────────
//
// Механизм: ленивая двухфазная выдача.
// Фаза 1 (search) → компактный список {id, summary}, без тела и карты якорей.
// Фаза 2 (get_notes) → полное тело + anchorMap по выбранной заметке.

describe("Story 01 — возврат к давно тронутой области", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("search даёт компактный список, get_notes разворачивает тело и карту якорей", async () => {
    // Фаза 1 — компактная выдача по entity:Order
    const r = (await h.call("search", { anchors: ["entity:Order"], format: "json" })) as {
      hits: Record<string, unknown>[];
      total: number;
      truncated: boolean;
    };

    expect(r.hits.length).toBeGreaterThanOrEqual(1);
    expect(r.hits.map((h) => h.id)).toContain("2026-05-10-order-cancellation-rule");

    // Каждый hit содержит только id + summary (статус отсутствует у current).
    // Тело, карта якорей и прочие поля — только в фазе 2.
    for (const hit of r.hits) {
      expect(hit).not.toHaveProperty("body");
      expect(hit).not.toHaveProperty("anchorMap");
      expect(hit).not.toHaveProperty("anchors");
    }

    // Фаза 2 — разворот по выбранному id
    const g = (await h.call("get_notes", { ids: ["2026-05-10-order-cancellation-rule"] })) as {
      notes: { id: string; body: string; anchorMap: unknown[] }[];
      missing: string[];
    };

    expect(g.missing).toHaveLength(0);
    expect(g.notes).toHaveLength(1);
    expect(g.notes[0].body).toBeTruthy();
    expect(g.notes[0].anchorMap.length).toBeGreaterThan(0);
  });
});

// ── Story 02 — инвариант не даёт повторить устаревший паттерн ────────────────
//
// Механизм: critical-якорь pinned поверх limit.
// 3 filler-заметки (newer, equal score) + 1 invariant (critical) с limit=1.
// После truncation в hits остаётся только pinned-заметка: 1 hit, total=4.

describe("Story 02 — инвариант не даёт повторить устаревший паттерн", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness((dir) => {
      // Каждый filler несёт ОДИН уникальный symbol-якорь веса core (df=1 → idf
      // равен idf у critical-якоря инварианта → одинаковый score → tiebreak по
      // updated ставит более новые fillers выше инварианта при limit-сортировке).
      writeFixtureNote(dir, {
        id: "2026-06-01-order-filler-1",
        summary: "Filler 1",
        status: "current",
        created: "2026-06-01",
        updated: "2026-06-01",
        anchors: [{ uri: "symbol:src/order.ts::Order.addLine", weight: "core" }],
        body: "## Body\n\nFiller.",
      });
      writeFixtureNote(dir, {
        id: "2026-06-02-order-filler-2",
        summary: "Filler 2",
        status: "current",
        created: "2026-06-02",
        updated: "2026-06-02",
        anchors: [{ uri: "symbol:src/order.ts::Order.place", weight: "core" }],
        body: "## Body\n\nFiller.",
      });
      writeFixtureNote(dir, {
        id: "2026-06-03-order-filler-3",
        summary: "Filler 3",
        status: "current",
        created: "2026-06-03",
        updated: "2026-06-03",
        anchors: [{ uri: "symbol:src/order.ts::formatOrder", weight: "core" }],
        body: "## Body\n\nFiller.",
      });
    });
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("critical-якорь pinned — инвариант выживает при limit=1, fillers усечены", async () => {
    // Поиск по 4 символам (инвариант + 3 fillers). Limit=1.
    // Все 4 заметки score-равны (idf одинаков при df=1 в корпусе 12 заметок).
    // Tiebreak по updated: fillers 2026-06-01..03 новее инварианта 2026-05-10.
    // Без pin: инвариант усечён как #4. С pin: инвариант гарантирован.
    const r = (await h.call("search", {
      anchors: [
        "symbol:src/order.ts::Order.cancel",   // critical на инварианте
        "symbol:src/order.ts::Order.addLine",  // core на filler-1
        "symbol:src/order.ts::Order.place",    // core на filler-2
        "symbol:src/order.ts::formatOrder",    // core на filler-3
      ],
      limit: 1,
      format: "json",
    })) as { hits: { id: string }[]; total: number; truncated: boolean };

    expect(r.total).toBe(4);
    expect(r.truncated).toBe(true);
    // Pinned-заметка держится поверх limit=1 → единственный hit
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].id).toBe("2026-05-10-order-cancellation-rule");

    // Подтверждаем: именно critical-якорь даёт pin
    const g = (await h.call("get_notes", { ids: ["2026-05-10-order-cancellation-rule"] })) as {
      notes: {
        anchorMap: { weight: string; anchors: { uri: string; status: string }[] }[];
      }[];
    };
    const critGroup = g.notes[0].anchorMap.find((grp) => grp.weight === "critical");
    expect(critGroup).toBeDefined();
    const critEntry = critGroup!.anchors.find(
      (a) => a.uri === "symbol:src/order.ts::Order.cancel",
    );
    expect(critEntry?.status).toBe("ok");
  });
});

// ── Story 03 — capture после нетривиальной задачи ────────────────────────────
//
// Механизм: create_note создаёт .md с якорями трёх весов (core/core/incidental),
// status=current. get_notes возвращает тело с шаблонными секциями.
// entity-якорь в anchorMap НЕ попадает — только через search по entity:.

describe("Story 03 — capture после нетривиальной задачи", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("create_note создаёт .md с правильными якорями, get_notes разворачивает тело", async () => {
    const r = (await h.call("create_note", {
      summary: "Гонка в модалке при async-валидации — починка флагом validation_in_flight",
      body: "## Что сделано\n\nИсправлена гонка.\n\n## Ключевые решения и почему\n\nФлаг в локальном стейте.\n\n## Что пробовали и отбросили\n\nuseTransition, Suspense.\n\n## Подводные камни\n\nБыстрый клик «назад» во время валидации.",
      anchors: [
        { uri: "symbol:src/cart.js::Cart.add", weight: "core" },
        { uri: "entity:Cart", weight: "core" },
        { uri: "file:src/cart.js", weight: "incidental" },
      ],
      status: "current",
    })) as { id: string };

    expect(r.id).toMatch(/^[a-z0-9]{5}$/);

    // .md-файл создан на диске
    expect(existsSync(join(h.dir, ".memory", "notes", `${r.id}.md`))).toBe(true);

    // get_notes: статус current, тело с шаблоном, anchorMap = symbol + file
    const g = (await h.call("get_notes", { ids: [r.id] })) as {
      notes: {
        id: string;
        status: string;
        body: string;
        anchorMap: { weight: string; anchors: { uri: string }[] }[];
      }[];
      missing: string[];
    };

    expect(g.missing).toHaveLength(0);
    const note = g.notes[0];
    expect(note.status).toBe("current");
    expect(note.body).toContain("## Что сделано");
    expect(note.body).toContain("## Подводные камни");

    const coreGroup = note.anchorMap.find((grp) => grp.weight === "core");
    expect(coreGroup?.anchors.map((a) => a.uri)).toContain("symbol:src/cart.js::Cart.add");

    const incGroup = note.anchorMap.find((grp) => grp.weight === "incidental");
    expect(incGroup?.anchors.map((a) => a.uri)).toContain("file:src/cart.js");

    // entity:Cart виден в anchorMap (getNotes отдаёт все типы якорей)
    const allUris = note.anchorMap.flatMap((grp) => grp.anchors.map((a) => a.uri));
    expect(allUris).toContain("entity:Cart");

    // entity-якорь записан корректно — заметка находится через entity:Cart
    const s = (await h.call("search", { anchors: ["entity:Cart"], format: "json" })) as {
      hits: { id: string }[];
    };
    expect(s.hits.map((h) => h.id)).toContain(r.id);
  });
});

// ── Story 04 — поиск по смутному воспоминанию ────────────────────────────────
//
// Механизм: текстовый путь, BM25-ранжирование.
// 3 аугментированные заметки с разной плотностью токенов запроса.
// Верхний hit — заметка с наибольшей BM25-релевантностью.

describe("Story 04 — поиск по смутному воспоминанию", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness((dir) => {
      // retry-policy: все три токена запроса ("повтор", "запрос", "backoff")
      // встречаются многократно в summary и body → наибольший BM25.
      writeFixtureNote(dir, {
        id: "2026-03-01-retry-policy",
        summary: "Политика повторных запросов с экспоненциальным backoff и jitter",
        status: "current",
        created: "2026-03-01",
        updated: "2026-03-01",
        anchors: [{ uri: "file:src/order.ts", weight: "core" }],
        body: "## Что сделано\n\nПовтор запроса при сбое: backoff растёт экспоненциально, backoff с jitter. Повтор только для идемпотентных запросов. Ключи идемпотентности — обязательны для POST-запросов.",
      });
      // http-timeout: "запрос" + "повтор" по разу — слабее
      writeFixtureNote(dir, {
        id: "2026-03-02-http-timeout",
        summary: "Таймауты HTTP-клиента",
        status: "current",
        created: "2026-03-02",
        updated: "2026-03-02",
        anchors: [{ uri: "file:src/order.ts", weight: "core" }],
        body: "## Что сделано\n\nТаймаут на запрос к внешнему API; повтор не настроен.",
      });
      // cart-cache: только "запрос" — самый слабый
      writeFixtureNote(dir, {
        id: "2026-03-03-cart-cache",
        summary: "Кэш корзины",
        status: "current",
        created: "2026-03-03",
        updated: "2026-03-03",
        anchors: [{ uri: "file:src/cart.js", weight: "core" }],
        body: "## Что сделано\n\nКэширование запроса списка позиций.",
      });
    });
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("текстовый поиск возвращает несколько хитов, лидер — наиболее релевантный", async () => {
    const r = (await h.call("search", {
      query: "повтор запрос backoff",
      format: "json",
    })) as {
      hits: { id: string; summary: string }[];
      total: number;
    };

    expect(r.hits.length).toBeGreaterThanOrEqual(2);
    // retry-policy — плотнейшее совпадение, должна быть первой
    expect(r.hits[0].id).toBe("2026-03-01-retry-policy");
    expect(r.hits.map((h) => h.id)).toContain("2026-03-02-http-timeout");

    // Разворот топового хита подтверждает решение о backoff
    const g = (await h.call("get_notes", { ids: ["2026-03-01-retry-policy"] })) as {
      notes: { body: string }[];
    };
    expect(g.notes[0].body).toContain("backoff");
  });
});

// ── Story 05 — планирование фичи на существующей инфраструктуре ──────────────
//
// Механизм: list_entities (карта домена) + комбинированный search(query, entity:)
// находит существующую инфру, на которую опирается план.

describe("Story 05 — планирование фичи на существующей инфраструктуре", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("list_entities отдаёт карту домена, search находит существующий инфра-узел", async () => {
    // Карта домена
    const ents = (await h.call("list_entities", { format: "json" })) as { name: string; description: string }[];
    expect(ents).toHaveLength(5);
    expect(ents.map((e) => e.name).sort()).toEqual([
      "Billing",
      "Cart",
      "Inventory",
      "Order",
      "Pricing",
    ]);
    for (const e of ents) {
      expect(typeof e.name).toBe("string");
      expect(typeof e.description).toBe("string");
    }

    // Комбинированный поиск: текст + якорь по entity → находит инфра-заметку
    const r = (await h.call("search", {
      query: "начисления",
      anchors: ["entity:Billing"],
      format: "json",
    })) as { hits: { id: string }[] };

    expect(r.hits.map((h) => h.id)).toContain("2026-05-14-invoice-totals");

    // Разворот: тело непустое (содержит инфо об инфраструктуре)
    const g = (await h.call("get_notes", { ids: ["2026-05-14-invoice-totals"] })) as {
      notes: { body: string }[];
    };
    expect(g.notes[0].body).toBeTruthy();
  });
});

// ── Story 06 — новое решение отменяет прежнее (superseding) ──────────────────
//
// Механизм: create_note(current) + update_note(old→outdated).
// Дефолтный поиск — только новая. include_archived — обе.
// Связь двух заметок — общий якорь entity:Pricing, без явных ссылок.

describe("Story 06 — новое решение отменяет прежнее", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("outdated скрыта по умолчанию, обе доступны с include_archived", async () => {
    // Создать новую заметку (текущее решение)
    const { id: newId } = (await h.call("create_note", {
      summary: "Новое решение по представлению цен",
      body: "## Что сделано\n\nПересмотр: целые центы, уточнённая точность.",
      anchors: [{ uri: "entity:Pricing", weight: "core" }],
      status: "current",
    })) as { id: string };

    // Помечаем прежнюю заметку устаревшей
    await h.call("update_note", {
      id: "2026-05-12-pricing-minor-units",
      status: "outdated",
    });

    // Дефолтный поиск: только текущая
    const def = (await h.call("search", { anchors: ["entity:Pricing"], format: "json" })) as {
      hits: { id: string; status?: string }[];
    };
    expect(def.hits.map((h) => h.id)).toContain(newId);
    expect(def.hits.map((h) => h.id)).not.toContain("2026-05-12-pricing-minor-units");

    // С архивом: обе заметки; outdated-hit несёт status-поле
    const arch = (await h.call("search", {
      anchors: ["entity:Pricing"],
      include_archived: true,
      format: "json",
    })) as { hits: { id: string; status?: string }[] };
    const archIds = arch.hits.map((h) => h.id);
    expect(archIds).toContain(newId);
    expect(archIds).toContain("2026-05-12-pricing-minor-units");

    const newHit = arch.hits.find((h) => h.id === newId);
    const oldHit = arch.hits.find((h) => h.id === "2026-05-12-pricing-minor-units");
    expect(newHit?.status).toBeUndefined(); // current → статус не передаётся
    expect(oldHit?.status).toBe("outdated");
  });
});

// ── Story 07 — рефакторинг: переименование с обновлением якорей ──────────────
//
// Ветка 1: rename_anchor обновляет URI во всех заметках, возвращает счётчик.
// Ветка 2: ручной rename вне скилла → якорь помечается stale при следующем
// get_notes (fixture уже содержит заметку с намеренно битыми якорями).

describe("Story 07 — рефакторинг: переименование с обновлением якорей", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("rename_anchor обновляет URI в заметках; ручной rename даёт stale-якорь", async () => {
    // Ветка 1: rename через скилл
    const r = (await h.call("rename_anchor", {
      old_uri: "symbol:src/pricing.go::NewPrice",
      new_uri: "symbol:src/pricing.go::CreatePrice",
    })) as { renamed: number };
    expect(r.renamed).toBe(2); // затронуты обе pricing-заметки

    // Заметка несёт новый URI
    const g = (await h.call("get_notes", { ids: ["2026-05-12-pricing-minor-units"] })) as {
      notes: { anchorMap: { anchors: { uri: string }[] }[] }[];
    };
    const uris = g.notes[0].anchorMap.flatMap((grp) => grp.anchors.map((a) => a.uri));
    expect(uris).toContain("symbol:src/pricing.go::CreatePrice");
    expect(uris).not.toContain("symbol:src/pricing.go::NewPrice");

    // Ветка 2: ручной rename вне скилла → якорь stale
    // 2026-05-09-stale-anchor-samples содержит намеренно битые якоря всех типов.
    const g2 = (await h.call("get_notes", { ids: ["2026-05-09-stale-anchor-samples"] })) as {
      notes: { anchorMap: { anchors: { uri: string; status: string }[] }[] }[];
    };
    const allEntries = g2.notes[0].anchorMap.flatMap((grp) => grp.anchors);
    expect(allEntries.some((a) => a.status === "stale")).toBe(true);
  });
});

// ── Story 08 — цепочка решений через [[id]] ──────────────────────────────────
//
// Механизм: [[id]] в теле резолвится в mentioned-блок {id,summary,stale}.
// Переход по цепочке — get_notes по нужному id.
// Edge case: ссылка на несуществующую заметку → stale:true.

describe("Story 08 — цепочка решений через [[id]]", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("[[id]] резолвится в mentioned-блок; несуществующий id помечается stale", async () => {
    const g = (await h.call("get_notes", { ids: ["2026-05-10-order-cancellation-rule"] })) as {
      notes: {
        mentioned: { id: string; summary?: string; status?: string; stale: boolean }[];
      }[];
    };

    const m = g.notes[0].mentioned;

    // Валидная ссылка: существующая draft-заметка — summary есть, status=draft
    const statusGuard = m.find((x) => x.id === "2026-05-15-status-guard-idea");
    expect(statusGuard).toBeDefined();
    expect(statusGuard!.stale).toBe(false);
    expect(statusGuard!.summary).toBeTruthy();
    expect(statusGuard!.status).toBe("draft"); // ≠ current → поле присутствует

    // Битая ссылка: несуществующая заметка — stale:true, summary отсутствует
    const nonexistent = m.find((x) => x.id === "2099-01-01-nonexistent");
    expect(nonexistent).toBeDefined();
    expect(nonexistent!.stale).toBe(true);
    expect(nonexistent!.summary).toBeUndefined();

    // Переход по цепочке: догружаем упомянутую заметку по требованию
    const g2 = (await h.call("get_notes", { ids: ["2026-05-15-status-guard-idea"] })) as {
      notes: { id: string; body: string }[];
      missing: string[];
    };
    expect(g2.notes).toHaveLength(1);
    expect(g2.notes[0].body).toBeTruthy();
    expect(g2.missing).toHaveLength(0);
  });
});

// ── Story 09 — онбординг существующего проекта ───────────────────────────────
//
// Механизм: create_entity + create_note(status=draft) + update_note(→current).
// Draft вне дефолтного поиска; после промоута — находится.
// .memory/onboarding.md — артефакт скилла, не фича сервиса; не тестируется.

describe("Story 09 — онбординг существующего проекта", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("create_entity + draft-заметка + промоут в current", async () => {
    // Зарегистрировать новую сущность
    const ent = (await h.call("create_entity", {
      name: "Shipping",
      description: "Доставка заказа покупателю.",
    })) as { name: string };
    expect(ent.name).toBe("Shipping");

    // Мигрировать знание из спеки как черновик
    const { id: draftId } = (await h.call("create_note", {
      summary: "Знание из docs/ — миграция онбординга",
      body: "## Что сделано\n\nЧерновик: описание доставки из раздела docs/.",
      anchors: [{ uri: "entity:Shipping", weight: "core" }],
      status: "draft",
    })) as { id: string };

    // Draft вне дефолтного поиска
    const s1 = (await h.call("search", { anchors: ["entity:Shipping"], format: "json" })) as {
      hits: { id: string }[];
    };
    expect(s1.hits.map((h) => h.id)).not.toContain(draftId);

    // Промоут после проверки
    await h.call("update_note", { id: draftId, status: "current" });

    // После промоута — заметка видна
    const s2 = (await h.call("search", { anchors: ["entity:Shipping"], format: "json" })) as {
      hits: { id: string }[];
    };
    expect(s2.hits.map((h) => h.id)).toContain(draftId);
  });
});

// ── Story 10 — разбор незнакомого кода ───────────────────────────────────────
//
// Механизм: для «свежей» сущности поиск возвращает пустой результат.
// После capture investigation-заметки (секции Verified + Hypothesis) — находится.

describe("Story 10 — разбор незнакомого кода", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 30_000);
  afterAll(async () => {
    await h.teardown();
  });

  it("поиск по свежей сущности пуст; investigation-заметка с Verified/Hypothesis находится", async () => {
    // Регистрируем сущность по которой ещё нет памяти
    await h.call("create_entity", {
      name: "Refunds",
      description: "Возврат средств за отменённый заказ.",
    });

    // Поиск пуст — нет накопленных заметок
    const empty = (await h.call("search", { anchors: ["entity:Refunds"], format: "json" })) as {
      hits: unknown[];
      total: number;
    };
    expect(empty.hits).toHaveLength(0);
    expect(empty.total).toBe(0);

    // Capture: investigation-заметка с разделением Verified / Hypothesis
    const { id } = (await h.call("create_note", {
      summary: "Разбор логики возвратов — начальное исследование",
      body: "## Verified\n\nПодтверждено чтением кода: метод `refund` транзакционный.\n\n## Hypothesis\n\nПредположительно: повторный запрос идемпотентен — проверить.",
      anchors: [{ uri: "entity:Refunds", weight: "core" }],
      status: "current",
    })) as { id: string };

    // Теперь поиск находит заметку
    const found = (await h.call("search", { anchors: ["entity:Refunds"], format: "json" })) as {
      hits: { id: string }[];
    };
    expect(found.hits.map((h) => h.id)).toContain(id);

    // Тело содержит оба шаблонных раздела investigation-заметки
    const g = (await h.call("get_notes", { ids: [id] })) as {
      notes: { body: string }[];
    };
    expect(g.notes[0].body).toContain("## Verified");
    expect(g.notes[0].body).toContain("## Hypothesis");
  });
});
