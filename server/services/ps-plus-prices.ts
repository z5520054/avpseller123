import type { DatabaseSync } from 'node:sqlite'
import { getDb } from '../db'

export const psPlusTiers = ['Essential', 'Extra', 'Deluxe'] as const
export const psPlusDurations = [1, 3, 12] as const

export type PsPlusTier = (typeof psPlusTiers)[number]
export type PsPlusDuration = (typeof psPlusDurations)[number]

export interface PsPlusPriceRecord {
  region: string
  tier: PsPlusTier
  durationMonths: PsPlusDuration
  priceRubMinor: number | null
  isActive: boolean
  updatedAt: string
}

function nowIso() {
  return new Date().toISOString()
}

function isTier(value: string): value is PsPlusTier {
  return psPlusTiers.includes(value as PsPlusTier)
}

function isDuration(value: number): value is PsPlusDuration {
  return psPlusDurations.includes(value as PsPlusDuration)
}

export class PsPlusPricesService {
  private db: DatabaseSync

  constructor(db = getDb()) {
    this.db = db
  }

  list(region = 'turkey') {
    this.ensureDefaults(region)

    const rows = this.db
      .prepare(
        `
        SELECT region, tier, duration_months, price_rub_minor, is_active, updated_at
        FROM ps_plus_prices
        WHERE region = ?
        ORDER BY
          CASE tier
            WHEN 'Essential' THEN 1
            WHEN 'Extra' THEN 2
            WHEN 'Deluxe' THEN 3
            ELSE 99
          END,
          duration_months
        `,
      )
      .all(region) as Array<Record<string, unknown>>

    return rows
      .filter((row) => isTier(String(row.tier)) && isDuration(Number(row.duration_months)))
      .map((row): PsPlusPriceRecord => ({
        region: String(row.region),
        tier: String(row.tier) as PsPlusTier,
        durationMonths: Number(row.duration_months) as PsPlusDuration,
        priceRubMinor: row.price_rub_minor === null ? null : Number(row.price_rub_minor),
        isActive: Number(row.is_active) === 1,
        updatedAt: String(row.updated_at),
      }))
  }

  get(region: string, tier: PsPlusTier, durationMonths: PsPlusDuration) {
    this.ensureDefaults(region)

    const row = this.db
      .prepare(
        `
        SELECT region, tier, duration_months, price_rub_minor, is_active, updated_at
        FROM ps_plus_prices
        WHERE region = ? AND tier = ? AND duration_months = ?
        `,
      )
      .get(region, tier, durationMonths) as Record<string, unknown> | undefined

    if (!row || !isTier(String(row.tier)) || !isDuration(Number(row.duration_months))) {
      return null
    }

    return {
      region: String(row.region),
      tier: String(row.tier) as PsPlusTier,
      durationMonths: Number(row.duration_months) as PsPlusDuration,
      priceRubMinor: row.price_rub_minor === null ? null : Number(row.price_rub_minor),
      isActive: Number(row.is_active) === 1,
      updatedAt: String(row.updated_at),
    } satisfies PsPlusPriceRecord
  }

  updateMany(input: {
    region: string
    items: Array<{
      tier: PsPlusTier
      durationMonths: PsPlusDuration
      priceRubMinor: number | null
      isActive: boolean
    }>
  }) {
    this.ensureDefaults(input.region)
    const timestamp = nowIso()

    const statement = this.db.prepare(
      `
      INSERT INTO ps_plus_prices (region, tier, duration_months, price_rub_minor, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(region, tier, duration_months) DO UPDATE SET
        price_rub_minor = excluded.price_rub_minor,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
      `,
    )

    this.db.exec('BEGIN')
    try {
      for (const item of input.items) {
        statement.run(
          input.region,
          item.tier,
          item.durationMonths,
          item.priceRubMinor,
          item.isActive ? 1 : 0,
          timestamp,
        )
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    return this.list(input.region)
  }

  private ensureDefaults(region: string) {
    const timestamp = nowIso()
    const statement = this.db.prepare(
      `
      INSERT OR IGNORE INTO ps_plus_prices (region, tier, duration_months, price_rub_minor, is_active, updated_at)
      VALUES (?, ?, ?, NULL, 1, ?)
      `,
    )

    this.db.exec('BEGIN')
    try {
      for (const tier of psPlusTiers) {
        for (const duration of psPlusDurations) {
          statement.run(region, tier, duration, timestamp)
        }
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
