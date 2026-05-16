CREATE TABLE orders (
  id      TEXT PRIMARY KEY,
  status  TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE order_lines (
  order_id  TEXT REFERENCES orders(id),
  sku       TEXT NOT NULL,
  quantity  INTEGER NOT NULL
);
