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
}
