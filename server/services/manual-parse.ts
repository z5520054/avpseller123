import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DatabaseSync } from 'node:sqlite'
import { getDb } from '../db'
import { PlayStationStoreProvider } from '../providers/playstation-store.provider'
import { CatalogRepository } from './catalog-repository'

const execFileAsync = promisify(execFile)
const workerState = {
  started: false,
  running: false,
}

type ParseType = 'price' | 'editions' | 'images'
type ParseRegion = 'turkey' | 'india' | 'all'
type ProxyRegion = 'turkey' | 'india'
type ProxyStatus = 'active' | 'disabled' | 'banned'

interface ProxyRow {
  id: number
  name: string
  type: string
  host: string
  port: number
  username: string
  password: string
  region: ProxyRegion
  status: ProxyStatus
  last_checked: string | null
  last_response_time_ms: number | null
  last_http_code: number | null
  error_count: number
  created_at: string
  updated_at: string
}

interface ParseTaskRow {
  id: number
  type: ParseType
  region: ParseRegion
  product_ids: string | null
  proxy_id: number | null
  status: 'pending' | 'running' | 'done' | 'failed'
  total_items: number
  processed_items: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
}

interface ProductTarget {
  id: number
  source_key: string
  locale: 'en-tr' | 'en-in'
  region: ProxyRegion
}

function nowIso() {
  return new Date().toISOString()
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizeRegion(region: string): ProxyRegion {
  return region === 'in' || region === 'india' ? 'india' : 'turkey'
}

function localeForRegion(region: ProxyRegion) {
  return region === 'turkey' ? 'en-tr' : 'en-in'
}

function buildProxyUrl(proxy: ProxyRow) {
  const auth = proxy.username ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : ''
  return `${proxy.type}://${auth}${proxy.host}:${proxy.port}`
}

function parseCurlHttpCode(error: unknown) {
  const output = error && typeof error === 'object' && 'stdout' in error ? String((error as { stdout?: string }).stdout ?? '') : ''
  const match = output.match(/HTTP_STATUS:(\d+)/)
  return match ? Number(match[1]) : null
}

async function fetchHtmlWithCurl(url: string, proxy?: ProxyRow | null) {
  const args = [
    '-L',
    '--silent',
    '--show-error',
    '--max-time',
    '45',
    '--connect-timeout',
    '20',
    '--compressed',
    '-A',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H',
    'Accept-Language: en-US,en;q=0.9',
  ]

  if (proxy) {
    args.push('--proxy', buildProxyUrl(proxy))
  }

  args.push(url, '-w', '\nHTTP_STATUS:%{http_code}')

  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  })
  const marker = '\nHTTP_STATUS:'
  const markerIndex = stdout.lastIndexOf(marker)
  const html = markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout
  const code = markerIndex >= 0 ? Number(stdout.slice(markerIndex + marker.length)) : 0

  if (code < 200 || code >= 300) {
    throw new Error(`PlayStation Store request failed: ${code} for ${url}`)
  }

  return html
}

function mapProxy(row: Record<string, unknown>): ProxyRow {
  return {
    id: Number(row.id),
    name: String(row.name),
    type: String(row.type),
    host: String(row.host),
    port: Number(row.port),
    username: String(row.username ?? ''),
    password: String(row.password ?? ''),
    region: normalizeRegion(String(row.region)),
    status: String(row.status) as ProxyStatus,
    last_checked: row.last_checked === null ? null : String(row.last_checked),
    last_response_time_ms: row.last_response_time_ms === null ? null : Number(row.last_response_time_ms),
    last_http_code: row.last_http_code === null ? null : Number(row.last_http_code),
    error_count: Number(row.error_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function publicProxy(proxy: ProxyRow) {
  return {
    ...proxy,
    password: proxy.password ? '********' : '',
  }
}

export class ManualParseService {
  constructor(private readonly db: DatabaseSync = getDb()) {}

  listProxies() {
    const rows = this.db.prepare('SELECT * FROM proxies ORDER BY region, status, error_count, id').all() as Array<Record<string, unknown>>
    return rows.map((row) => publicProxy(mapProxy(row)))
  }

  getProxy(id: number) {
    const row = this.db.prepare('SELECT * FROM proxies WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? mapProxy(row) : null
  }

  createProxy(input: {
    name: string
    type: string
    host: string
    port: number
    username?: string
    password?: string
    region: string
    testBeforeSave?: boolean
  }) {
    const timestamp = nowIso()
    const row = this.db
      .prepare(
        `
        INSERT INTO proxies (name, type, host, port, username, password, region, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        RETURNING *
        `,
      )
      .get(
        input.name,
        input.type,
        input.host,
        input.port,
        input.username ?? '',
        input.password ?? '',
        normalizeRegion(input.region),
        timestamp,
        timestamp,
      ) as Record<string, unknown>
    const proxy = mapProxy(row)

    if (input.testBeforeSave) {
      return this.testProxy(proxy.id).then((result) => {
        if (result.status !== 'ok') {
          this.deleteProxy(proxy.id)
          throw new Error(result.errorMessage ?? 'Proxy test failed')
        }

        return publicProxy(proxy)
      })
    }

    return Promise.resolve(publicProxy(proxy))
  }

  updateProxy(id: number, input: Partial<{
    name: string
    type: string
    host: string
    port: number
    username: string
    password: string
    region: string
    status: ProxyStatus
  }>) {
    const current = this.getProxy(id)
    if (!current) return null

    const next = {
      ...current,
      ...input,
      region: input.region ? normalizeRegion(input.region) : current.region,
      updated_at: nowIso(),
    }

    this.db
      .prepare(
        `
        UPDATE proxies
        SET name = ?, type = ?, host = ?, port = ?, username = ?, password = ?, region = ?, status = ?, updated_at = ?
        WHERE id = ?
        `,
      )
      .run(next.name, next.type, next.host, next.port, next.username, next.password, next.region, next.status, next.updated_at, id)

    const updated = this.getProxy(id)
    return updated ? publicProxy(updated) : null
  }

  deleteProxy(id: number) {
    this.db.prepare('DELETE FROM proxies WHERE id = ?').run(id)
    return { success: true }
  }

  toggleProxy(id: number) {
    const proxy = this.getProxy(id)
    if (!proxy) return null
    const status = proxy.status === 'active' ? 'disabled' : 'active'
    return this.updateProxy(id, { status })
  }

  async testProxy(id: number) {
    const proxy = this.getProxy(id)
    if (!proxy) {
      throw new Error('Proxy not found')
    }

    const started = Date.now()
    const url = `https://store.playstation.com/${localeForRegion(proxy.region)}/`
    let httpCode: number | null
    let status = 'ok'
    let errorMessage: string | null = null

    try {
      await fetchHtmlWithCurl(url, proxy)
      httpCode = 200
    } catch (error) {
      httpCode = parseCurlHttpCode(error)
      status = httpCode === 403 ? 'banned' : httpCode === 429 ? 'limited' : 'error'
      errorMessage = error instanceof Error ? error.message : String(error)
    }

    const responseTimeMs = Date.now() - started
    const timestamp = nowIso()
    this.db
      .prepare(
        `
        INSERT INTO proxy_checks (proxy_id, checked_at, response_time_ms, http_code, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(id, timestamp, responseTimeMs, httpCode, status, errorMessage)
    this.db
      .prepare(
        `
        UPDATE proxies
        SET last_checked = ?, last_response_time_ms = ?, last_http_code = ?,
            status = CASE WHEN ? = 'banned' THEN 'banned' ELSE status END,
            error_count = CASE WHEN ? = 'ok' THEN 0 ELSE error_count + 1 END,
            updated_at = ?
        WHERE id = ?
        `,
      )
      .run(timestamp, responseTimeMs, httpCode, status, status, timestamp, id)

    return {
      success: status === 'ok',
      status,
      responseTimeMs,
      httpCode,
      errorMessage,
      message: status === 'ok' ? 'Прокси работает' : errorMessage ?? 'Прокси не прошел проверку',
    }
  }

  listProxyChecks(proxyId: number) {
    return this.db
      .prepare('SELECT * FROM proxy_checks WHERE proxy_id = ? ORDER BY checked_at DESC LIMIT 30')
      .all(proxyId)
  }

  listTasks(limit = 30) {
    return this.db.prepare('SELECT * FROM parse_tasks ORDER BY created_at DESC LIMIT ?').all(limit)
  }

  getTask(id: number) {
    return this.db.prepare('SELECT * FROM parse_tasks WHERE id = ?').get(id)
  }

  resumeTask(id: number) {
    const task = this.getTask(id) as ParseTaskRow | undefined
    if (!task) {
      throw new Error('Task not found')
    }

    if (task.status === 'pending' || task.status === 'running') {
      throw new Error('Task is still active. Resume is available only after the task stops.')
    }

    const processedItems = Math.max(0, Math.min(task.processed_items, task.total_items))
    const targets = this.getTargets(task)
    const remainingTargets = targets.slice(processedItems)

    if (remainingTargets.length === 0) {
      throw new Error('No remaining products to resume')
    }

    return {
      ...this.createTask({
        type: task.type,
        region: task.region,
        productIds: remainingTargets.map((target) => target.id),
        proxyId: task.proxy_id,
      }),
      resumedFromTaskId: task.id,
      skippedItems: processedItems,
      remainingItems: remainingTargets.length,
    }
  }

  listParseProducts(input: { region?: string; query?: string; limit: number; offset: number }) {
    const region = input.region && input.region !== 'all' ? normalizeRegion(input.region) : null
    const clauses = ["p.source = 'playstation-store'"]
    const params: Array<string | number> = []

    if (region) {
      clauses.push('EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = ?)')
      params.push(region)
    }

    if (input.query) {
      clauses.push('(p.title_normalized LIKE ? OR p.source_key LIKE ?)')
      params.push(`%${input.query.trim().toLowerCase()}%`, `%${input.query.trim()}%`)
    }

    const rows = this.db
      .prepare(
        `
        SELECT
          p.id,
          p.source_key,
          p.title,
          p.cover_url,
          p.last_updated,
          p.last_status,
          p.error_count,
          (
            SELECT COUNT(*)
            FROM product_details pd, json_each(pd.editions_json) edition
            WHERE pd.product_id = p.id
          ) AS editions_count,
          (
            SELECT COALESCE(o.discounted_price_minor, o.base_price_minor)
            FROM offers o
            WHERE o.product_id = p.id
              ${region ? 'AND o.region = ?' : ''}
            ORDER BY COALESCE(o.discounted_price_minor, o.base_price_minor) ASC
            LIMIT 1
          ) AS price_minor
        FROM products p
        WHERE ${clauses.join(' AND ')}
        ORDER BY p.updated_at DESC
        LIMIT ? OFFSET ?
        `,
      )
      .all(...(region ? [region] : []), ...params, input.limit, input.offset) as Array<Record<string, unknown>>

    const total = this.db
      .prepare(`SELECT COUNT(*) AS total FROM products p WHERE ${clauses.join(' AND ')}`)
      .get(...params) as { total: number }

    return { items: rows, total: total.total }
  }

  createTask(input: { type: ParseType; region: ParseRegion; productIds?: Array<number | string> | null; proxyId?: number | null }) {
    const timestamp = nowIso()
    const productIds = input.productIds?.length ? input.productIds : null
    const totalItems = productIds ? productIds.length : this.countProductsForTask(input.region)
    const row = this.db
      .prepare(
        `
        INSERT INTO parse_tasks (type, region, product_ids, proxy_id, status, total_items, processed_items, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?, 0, ?)
        RETURNING id, status, total_items
        `,
      )
      .get(input.type, input.region, productIds ? JSON.stringify(productIds) : null, input.proxyId ?? null, totalItems, timestamp) as {
        id: number
        status: string
        total_items: number
      }

    return { taskId: row.id, status: 'created', totalItems: row.total_items }
  }

  private countProductsForTask(region: ParseRegion) {
    if (region === 'all') {
      const row = this.db.prepare("SELECT COUNT(*) AS total FROM products WHERE source = 'playstation-store'").get() as { total: number }
      return row.total
    }

    const normalized = normalizeRegion(region)
    const row = this.db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM products p
        WHERE p.source = 'playstation-store'
          AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = ?)
        `,
      )
      .get(normalized) as { total: number }
    return row.total
  }

  takeNextTask(): ParseTaskRow | null {
    const task = this.db
      .prepare("SELECT * FROM parse_tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
      .get() as ParseTaskRow | undefined

    if (!task) return null

    this.db
      .prepare("UPDATE parse_tasks SET status = 'running', started_at = ? WHERE id = ?")
      .run(nowIso(), task.id)

    return { ...task, status: 'running', started_at: nowIso() }
  }

  markTaskDone(id: number, processed: number) {
    this.db
      .prepare("UPDATE parse_tasks SET status = 'done', processed_items = ?, finished_at = ?, error_message = NULL WHERE id = ?")
      .run(processed, nowIso(), id)
  }

  markTaskFailed(id: number, message: string, processed?: number) {
    this.db
      .prepare(
        `
        UPDATE parse_tasks
        SET status = 'failed', processed_items = COALESCE(?, processed_items), finished_at = ?, error_message = ?
        WHERE id = ?
        `,
      )
      .run(processed ?? null, nowIso(), message.slice(0, 1000), id)
  }

  updateTaskProgress(id: number, processed: number) {
    this.db.prepare('UPDATE parse_tasks SET processed_items = ? WHERE id = ?').run(processed, id)
  }

  markProductParseResult(id: number, status: string, errorDelta: number) {
    this.db
      .prepare(
        `
        UPDATE products
        SET last_updated = ?, last_status = ?, error_count = MAX(0, error_count + ?), next_retry_at = NULL
        WHERE id = ?
        `,
      )
      .run(nowIso(), status, errorDelta, id)
  }

  selectProxy(region: ProxyRegion, proxyId: number | null) {
    if (proxyId) {
      const proxy = this.getProxy(proxyId)
      if (!proxy || proxy.status !== 'active') {
        throw new Error('Selected proxy is not active')
      }
      return proxy
    }

    const row = this.db
      .prepare(
        `
        SELECT *
        FROM proxies
        WHERE region = ? AND status = 'active'
        ORDER BY error_count ASC, last_response_time_ms ASC NULLS LAST, id ASC
        LIMIT 1
        `,
      )
      .get(region) as Record<string, unknown> | undefined

    return row ? mapProxy(row) : null
  }

  markProxyBanned(id: number) {
    this.db
      .prepare("UPDATE proxies SET status = 'banned', error_count = error_count + 1, updated_at = ? WHERE id = ?")
      .run(nowIso(), id)
  }

  getTargets(task: ParseTaskRow): ProductTarget[] {
    const ids = task.product_ids ? JSON.parse(task.product_ids) as Array<number | string> : null
    const regionClause = task.region === 'all'
      ? ''
      : 'AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = ?)'
    const params = task.region === 'all' ? [] : [normalizeRegion(task.region)]

    if (ids) {
      const targets = ids
        .map((id) => {
          const row = typeof id === 'number' || /^\d+$/.test(String(id))
            ? this.db.prepare(`
                SELECT
                  id,
                  source_key,
                  CASE
                    WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = products.id AND o.region = 'turkey') THEN 'turkey'
                    WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = products.id AND o.region = 'india') THEN 'india'
                    ELSE 'turkey'
                  END AS target_region
                FROM products
                WHERE id = ?
              `).get(Number(id))
            : this.db.prepare(`
                SELECT
                  id,
                  source_key,
                  CASE
                    WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = products.id AND o.region = 'turkey') THEN 'turkey'
                    WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = products.id AND o.region = 'india') THEN 'india'
                    ELSE 'turkey'
                  END AS target_region
                FROM products
                WHERE source_key = ?
              `).get(String(id))
          return row as { id: number; source_key: string; target_region: ProxyRegion } | undefined
        })
        .filter((item): item is { id: number; source_key: string; target_region: ProxyRegion } => Boolean(item))

      return targets.map((item) => {
        const region = task.region === 'all' ? item.target_region : task.region === 'india' ? 'india' : 'turkey'
        return { id: item.id, source_key: item.source_key, region, locale: localeForRegion(region) }
      })
    }

    const rows = this.db
      .prepare(
        `
        SELECT
          p.id,
          p.source_key,
          CASE
            WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = 'turkey') THEN 'turkey'
            WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = 'india') THEN 'india'
            ELSE 'turkey'
          END AS target_region
        FROM products p
        WHERE p.source = 'playstation-store' ${regionClause}
        ORDER BY p.id
        `,
      )
      .all(...params) as Array<{ id: number; source_key: string; target_region: ProxyRegion }>

    return rows.map((item) => {
      const region = task.region === 'all' ? item.target_region : task.region === 'india' ? 'india' : 'turkey'
      return { id: item.id, source_key: item.source_key, region, locale: localeForRegion(region) }
    })
  }
}

async function processTask(task: ParseTaskRow) {
  const service = new ManualParseService()
  const repository = new CatalogRepository()
  const targets = service.getTargets(task)
  let processed = 0

  const markAttemptProcessed = async () => {
    processed += 1
    if (processed % 5 === 0) {
      service.updateTaskProgress(task.id, processed)
    }

    await sleep(3_000 + Math.floor(Math.random() * 2_000))
  }

  for (const target of targets) {
    const proxy = service.selectProxy(target.region, task.proxy_id)
    const provider = new PlayStationStoreProvider(proxy ? (url) => fetchHtmlWithCurl(url, proxy) : undefined)

    try {
      const detail = await provider.fetchProductDetail(target.source_key, target.locale)
      repository.upsertProductDetail(target.id, detail)

      if (task.type === 'editions' || task.type === 'price') {
        repository.upsertEditionProductsFromDetail(target.id, detail)
      }

      service.markProductParseResult(target.id, 'ok', -1)
      await markAttemptProcessed()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isBlocked = message.includes('403') || message.includes('429')
      service.markProductParseResult(target.id, isBlocked ? 'blocked' : `error: ${message.slice(0, 180)}`, 1)

      if (proxy && message.includes('403')) {
        service.markProxyBanned(proxy.id)
        throw new Error(`403 from PlayStation Store. Proxy ${proxy.name} was marked banned. ${message}`, { cause: error })
      }

      if (message.includes('429')) {
        throw new Error(`429 rate limit from PlayStation Store. Task stopped: ${message}`, { cause: error })
      }

      await markAttemptProcessed()
    }
  }

  service.updateTaskProgress(task.id, processed)
  service.markTaskDone(task.id, processed)
}

export function startManualParseWorker() {
  if (workerState.started) return
  workerState.started = true

  const tick = async () => {
    if (workerState.running) return
    workerState.running = true
    const service = new ManualParseService()
    const task = service.takeNextTask()

    if (task) {
      try {
        await processTask(task)
      } catch (error) {
        service.markTaskFailed(task.id, error instanceof Error ? error.message : String(error))
      }
    }

    workerState.running = false
  }

  setInterval(() => {
    void tick()
  }, 5_000).unref()
}
