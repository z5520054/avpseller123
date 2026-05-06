import type { DatabaseSync } from 'node:sqlite'
import { config } from '../config'
import { getDb } from '../db'
import type { CartRecalculationResult } from '../types'

function nowIso() {
  return new Date().toISOString()
}

function maskCode(value: string) {
  if (value.length <= 8) {
    return '••••••'
  }

  return `${value.slice(0, 4)}••••••${value.slice(-4)}`
}

function parseJson<T>(value: unknown, fallback: T) {
  if (typeof value !== 'string') return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export class FulfillmentService {
  constructor(private readonly db: DatabaseSync = getDb()) {
    this.seedDefaults()
  }

  seedDefaults() {
    const timestamp = nowIso()
    for (const nominal of config.turkeyTopUpCodeNominals) {
      this.db
        .prepare(
          `
          INSERT INTO top_up_denominations (nominal_try, price_rub_minor, is_active, created_at, updated_at)
          VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(nominal_try) DO NOTHING
          `,
        )
        .run(nominal, nominal * config.turkeyRubRate * 100, timestamp, timestamp)
    }

    this.db
      .prepare(
        `
        INSERT INTO fulfillment_settings (id, mode, updated_at)
        VALUES (1, 'manual', ?)
        ON CONFLICT(id) DO NOTHING
        `,
      )
      .run(timestamp)
  }

  getMode() {
    const row = this.db.prepare('SELECT mode FROM fulfillment_settings WHERE id = 1').get() as { mode: string } | undefined
    return row?.mode === 'automatic' ? 'automatic' : 'manual'
  }

  updateMode(mode: 'automatic' | 'manual') {
    this.db
      .prepare(
        `
        INSERT INTO fulfillment_settings (id, mode, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at
        `,
      )
      .run(mode, nowIso())
    return { mode }
  }

  listDenominations() {
    return this.db
      .prepare(
        `
        SELECT
          d.nominal_try,
          d.price_rub_minor,
          d.is_active,
          COUNT(CASE WHEN c.status = 'active' THEN 1 END) AS active_count,
          COUNT(CASE WHEN c.status = 'sold' THEN 1 END) AS sold_count
        FROM top_up_denominations d
        LEFT JOIN top_up_codes c ON c.nominal_try = d.nominal_try
        GROUP BY d.nominal_try
        ORDER BY d.nominal_try
        `,
      )
      .all()
  }

  updateDenomination(input: { nominalTry: number; priceRubMinor: number; isActive: boolean }) {
    this.db
      .prepare(
        `
        INSERT INTO top_up_denominations (nominal_try, price_rub_minor, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(nominal_try) DO UPDATE SET
          price_rub_minor = excluded.price_rub_minor,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
        `,
      )
      .run(input.nominalTry, input.priceRubMinor, input.isActive ? 1 : 0, nowIso(), nowIso())
    return this.listDenominations()
  }

  listCodes(input: { nominalTry?: number; status?: string; reveal?: boolean; limit?: number }) {
    const clauses = ['1 = 1']
    const params: Array<string | number> = []

    if (input.nominalTry) {
      clauses.push('nominal_try = ?')
      params.push(input.nominalTry)
    }

    if (input.status && input.status !== 'all') {
      clauses.push('status = ?')
      params.push(input.status)
    }

    const rows = this.db
      .prepare(
        `
        SELECT id, nominal_try, code, status, order_id, added_at, sold_at
        FROM top_up_codes
        WHERE ${clauses.join(' AND ')}
        ORDER BY id DESC
        LIMIT ?
        `,
      )
      .all(...params, input.limit ?? 100) as Array<Record<string, unknown>>

    return rows.map((row) => ({
      id: Number(row.id),
      nominalTry: Number(row.nominal_try),
      code: input.reveal ? String(row.code) : maskCode(String(row.code)),
      status: String(row.status),
      orderId: row.order_id === null ? null : Number(row.order_id),
      addedAt: String(row.added_at),
      soldAt: row.sold_at === null ? null : String(row.sold_at),
    }))
  }

  addCodes(input: { nominalTry: number; codes: string[] }) {
    const timestamp = nowIso()
    let added = 0

    for (const code of input.codes.map((item) => item.trim()).filter(Boolean)) {
      try {
        this.db
          .prepare(
            `
            INSERT INTO top_up_codes (nominal_try, code, status, added_at)
            VALUES (?, ?, 'active', ?)
            `,
          )
          .run(input.nominalTry, code, timestamp)
        added += 1
      } catch {
        // Duplicate codes are ignored during bulk import.
      }
    }

    return { added, codes: this.listCodes({ nominalTry: input.nominalTry, status: 'active' }) }
  }

  deleteUnusedCode(id: number) {
    const result = this.db.prepare("DELETE FROM top_up_codes WHERE id = ? AND status = 'active'").run(id)
    return { success: result.changes > 0 }
  }

  listOrders(input: { status?: string; query?: string; limit?: number }) {
    const clauses = ['1 = 1']
    const params: Array<string | number> = []

    if (input.status && input.status !== 'all') {
      clauses.push('status = ?')
      params.push(input.status)
    }

    if (input.query) {
      clauses.push('(CAST(id AS TEXT) = ? OR email LIKE ?)')
      params.push(input.query.trim(), `%${input.query.trim()}%`)
    }

    return this.db
      .prepare(
        `
        SELECT id, email, region, status, payment_id, payment_status, fulfillment_mode,
               cart_snapshot_json, paid_at, issued_at, created_at, updated_at
        FROM orders
        WHERE ${clauses.join(' AND ')}
        ORDER BY id DESC
        LIMIT ?
        `,
      )
      .all(...params, input.limit ?? 100)
  }

  getDashboard() {
    const todayPrefix = new Date().toISOString().slice(0, 10)
    const today = this.db.prepare("SELECT COUNT(*) AS total FROM orders WHERE created_at LIKE ?").get(`${todayPrefix}%`) as { total: number }
    const pending = this.db.prepare("SELECT COUNT(*) AS total FROM orders WHERE status IN ('paid', 'pending')").get() as { total: number }
    return {
      mode: this.getMode(),
      ordersToday: today.total,
      waitingOrders: pending.total,
      denominations: this.listDenominations(),
    }
  }

  assignAutomaticCodes(orderId: number) {
    const order = this.db.prepare('SELECT cart_snapshot_json FROM orders WHERE id = ?').get(orderId) as
      | { cart_snapshot_json: string }
      | undefined
    if (!order) {
      throw new Error('Order not found')
    }

    const cart = parseJson<CartRecalculationResult | null>(order.cart_snapshot_json, null)
    const requiredCodes = cart?.autoCodeItems ?? []
    if (requiredCodes.length === 0) {
      this.markOrderIssued(orderId)
      return { assigned: 0, missingNominals: [] as number[] }
    }

    const missingNominals: number[] = []
    let assigned = 0
    const timestamp = nowIso()

    this.db.exec('BEGIN IMMEDIATE')
    try {
      for (const item of requiredCodes) {
        const code = this.db
          .prepare(
            `
            SELECT id, code
            FROM top_up_codes
            WHERE nominal_try = ? AND status = 'active'
            ORDER BY id
            LIMIT 1
            `,
          )
          .get(item.nominalTry) as { id: number; code: string } | undefined

        if (!code) {
          missingNominals.push(item.nominalTry)
          continue
        }

        this.db.prepare("UPDATE top_up_codes SET status = 'sold', order_id = ?, sold_at = ? WHERE id = ?").run(orderId, timestamp, code.id)
        this.db
          .prepare(
            `
            INSERT INTO order_code_assignments (order_id, top_up_code_id, nominal_try, code_snapshot, assigned_at)
            VALUES (?, ?, ?, ?, ?)
            `,
          )
          .run(orderId, code.id, item.nominalTry, code.code, timestamp)
        assigned += 1
      }

      if (missingNominals.length === 0) {
        this.markOrderIssued(orderId, timestamp)
      }

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    return { assigned, missingNominals }
  }

  assignManualCode(orderId: number, nominalTry: number, code: string) {
    const timestamp = nowIso()
    this.db
      .prepare(
        `
        INSERT INTO order_code_assignments (order_id, top_up_code_id, nominal_try, code_snapshot, assigned_at)
        VALUES (?, NULL, ?, ?, ?)
        `,
      )
      .run(orderId, nominalTry, code.trim(), timestamp)
    this.markOrderIssued(orderId, timestamp)
    return { success: true }
  }

  private markOrderIssued(orderId: number, timestamp = nowIso()) {
    this.db.prepare("UPDATE orders SET status = 'code_sent', issued_at = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, orderId)
  }
}
