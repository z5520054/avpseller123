import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config'
import { schemaSql } from './lib/schema'

let database: DatabaseSync | null = null

export function getDb() {
  if (database) {
    return database
  }

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })
  database = new DatabaseSync(config.dbPath)
  database.exec('PRAGMA journal_mode = WAL;')
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec(schemaSql)
  ensureMigrations(database)
  return database
}

function ensureMigrations(db: DatabaseSync) {
  const productColumns = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>
  const productColumnNames = new Set(productColumns.map((column) => column.name))

  if (!productColumnNames.has('region')) {
    db.exec('ALTER TABLE products ADD COLUMN region TEXT;')
  }

  if (!productColumnNames.has('last_updated')) {
    db.exec('ALTER TABLE products ADD COLUMN last_updated TEXT;')
  }

  if (!productColumnNames.has('last_status')) {
    db.exec('ALTER TABLE products ADD COLUMN last_status TEXT;')
  }

  if (!productColumnNames.has('error_count')) {
    db.exec('ALTER TABLE products ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0;')
  }

  if (!productColumnNames.has('next_retry_at')) {
    db.exec('ALTER TABLE products ADD COLUMN next_retry_at TEXT;')
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_region ON products(region);
    CREATE INDEX IF NOT EXISTS idx_products_last_updated ON products(last_updated);
  `)

  const columns = db.prepare('PRAGMA table_info(product_details)').all() as Array<{ name: string }>
  const columnNames = new Set(columns.map((column) => column.name))

  if (!columnNames.has('editions_json')) {
    db.exec("ALTER TABLE product_details ADD COLUMN editions_json TEXT NOT NULL DEFAULT '[]';")
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS home_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_position_x INTEGER NOT NULL DEFAULT 50,
      image_position_y INTEGER NOT NULL DEFAULT 50,
      image_scale REAL NOT NULL DEFAULT 1,
      link_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  const bannerColumns = db.prepare('PRAGMA table_info(home_banners)').all() as Array<{ name: string }>
  const bannerColumnNames = new Set(bannerColumns.map((column) => column.name))

  if (!bannerColumnNames.has('image_position_x')) {
    db.exec('ALTER TABLE home_banners ADD COLUMN image_position_x INTEGER NOT NULL DEFAULT 50;')
  }

  if (!bannerColumnNames.has('image_position_y')) {
    db.exec('ALTER TABLE home_banners ADD COLUMN image_position_y INTEGER NOT NULL DEFAULT 50;')
  }

  if (!bannerColumnNames.has('image_scale')) {
    db.exec('ALTER TABLE home_banners ADD COLUMN image_scale REAL NOT NULL DEFAULT 1;')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS home_banner_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      autoplay_ms INTEGER NOT NULL DEFAULT 6000,
      animation TEXT NOT NULL DEFAULT 'slide',
      updated_at TEXT NOT NULL
    );
  `)

  const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>
  const orderColumnNames = new Set(orderColumns.map((column) => column.name))

  const orderColumnSql: Record<string, string> = {
    payment_provider: 'ALTER TABLE orders ADD COLUMN payment_provider TEXT;',
    payment_id: 'ALTER TABLE orders ADD COLUMN payment_id TEXT;',
    payment_status: 'ALTER TABLE orders ADD COLUMN payment_status TEXT;',
    payment_confirmation_url: 'ALTER TABLE orders ADD COLUMN payment_confirmation_url TEXT;',
    fulfillment_mode: "ALTER TABLE orders ADD COLUMN fulfillment_mode TEXT NOT NULL DEFAULT 'manual';",
    paid_at: 'ALTER TABLE orders ADD COLUMN paid_at TEXT;',
    issued_at: 'ALTER TABLE orders ADD COLUMN issued_at TEXT;',
  }

  for (const [column, sql] of Object.entries(orderColumnSql)) {
    if (!orderColumnNames.has(column)) {
      db.exec(sql)
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_id
      ON orders(payment_id)
      WHERE payment_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS top_up_denominations (
      nominal_try INTEGER PRIMARY KEY,
      price_rub_minor INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS top_up_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nominal_try INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      order_id INTEGER,
      added_at TEXT NOT NULL,
      sold_at TEXT,
      FOREIGN KEY (nominal_try) REFERENCES top_up_denominations(nominal_try),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_top_up_codes_nominal_status
      ON top_up_codes(nominal_try, status, id);

    CREATE TABLE IF NOT EXISTS order_code_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      top_up_code_id INTEGER,
      nominal_try INTEGER NOT NULL,
      code_snapshot TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (top_up_code_id) REFERENCES top_up_codes(id)
    );

    CREATE TABLE IF NOT EXISTS fulfillment_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL DEFAULT 'manual',
      updated_at TEXT NOT NULL
    );
  `)
}
