import type { DatabaseSync } from 'node:sqlite'
import { getDb } from '../db'
import { deriveStoreType, recalculateTurkeyCart, toCommercialOffer } from '../lib/commerce'
import { PsPlusPricesService, type PsPlusDuration, type PsPlusTier } from './ps-plus-prices'
import type {
  CartInputItem,
  CatalogListItem,
  EntityId,
  CatalogProductDetail,
  ImportOffer,
  ImportedProduct,
  ImportedProductDetail,
  OrderRecord,
  ProductKind,
  ProductSourceRank,
  ProductStatus,
  SyncMode,
} from '../types'

function nowIso() {
  return new Date().toISOString()
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase()
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseJson<T>(value: unknown, fallback: T) {
  if (typeof value !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapOffer(row: Record<string, unknown>): ImportOffer {
  return {
    region: String(row.region),
    currency: String(row.currency),
    basePriceMinor: row.base_price_minor === null ? null : Number(row.base_price_minor),
    discountedPriceMinor: row.discounted_price_minor === null ? null : Number(row.discounted_price_minor),
    discountPercent: row.discount_percent === null ? null : Number(row.discount_percent),
    saleStartAt: row.sale_start_at === null ? null : String(row.sale_start_at),
    saleEndAt: row.sale_end_at === null ? null : String(row.sale_end_at),
    plusTier: row.plus_tier === null ? null : String(row.plus_tier),
    saleName: row.sale_name === null ? null : String(row.sale_name),
    availability: String(row.availability),
    sourceUpdatedAt: row.source_updated_at === null ? null : String(row.source_updated_at),
  }
}

function hasRussianLanguage(languages: string[]) {
  if (languages.length === 0) {
    return null
  }

  return languages.some((language) => {
    const normalized = language.trim().toLowerCase()
    return normalized === 'ru' || normalized.startsWith('ru_') || normalized.includes('russian') || normalized.includes('рус')
  })
}

function hasRussianInJsonEach(alias: string) {
  return `(LOWER(${alias}.value) = 'ru' OR LOWER(${alias}.value) LIKE 'ru_%' OR LOWER(${alias}.value) LIKE '%russian%' OR LOWER(${alias}.value) LIKE '%рус%')`
}

function getRussianLanguageSupport(spokenLanguages: string[], screenLanguages: string[]) {
  if (spokenLanguages.length === 0 && screenLanguages.length === 0) {
    return 'unknown'
  }

  const hasRussianVoice = hasRussianLanguage(spokenLanguages) === true
  const hasRussianScreen = hasRussianLanguage(screenLanguages) === true

  if (hasRussianVoice && hasRussianScreen) {
    return 'full'
  }

  if (hasRussianScreen) {
    return 'subtitles'
  }

  return 'none'
}

export class CatalogRepository {
  private db: DatabaseSync

  constructor(db = getDb()) {
    this.db = db
  }

  startSyncRun(provider: string, mode: SyncMode) {
    const row = this.db
      .prepare(
        `
        INSERT INTO sync_runs (provider, mode, status, started_at)
        VALUES (?, ?, 'running', ?)
        RETURNING id
        `,
      )
      .get(provider, mode, nowIso()) as { id: number }
    return row.id
  }

  finishSyncRun(id: number, status: 'success' | 'failed', stats: { products: number; offers: number }, errorText?: string) {
    this.db
      .prepare(
        `
        UPDATE sync_runs
        SET status = ?, finished_at = ?, imported_products = ?, imported_offers = ?, error_text = ?
        WHERE id = ?
        `,
      )
      .run(status, nowIso(), stats.products, stats.offers, errorText ?? null, id)
  }

  upsertProduct(product: ImportedProduct) {
    const timestamp = nowIso()
    const existing = this.db
      .prepare('SELECT id FROM products WHERE source_key = ?')
      .get(product.sourceKey) as { id: number } | undefined

    let productId = existing?.id
    if (productId) {
      this.db
        .prepare(
          `
          UPDATE products
          SET source = ?, slug = ?, title = ?, title_normalized = ?, kind = ?, product_url = ?,
              cover_url = ?, release_date = ?, publisher = ?, developer = ?, status = ?, updated_at = ?
          WHERE id = ?
          `,
        )
        .run(
          product.source,
          product.slug,
          product.title,
          normalizeTitle(product.title),
          product.kind,
          product.productUrl,
          product.coverUrl,
          product.releaseDate,
          product.publisher,
          product.developer,
          product.status,
          timestamp,
          productId,
        )
    } else {
      const row = this.db
        .prepare(
          `
          INSERT INTO products (
            source, source_key, slug, title, title_normalized, kind, product_url,
            cover_url, release_date, publisher, developer, status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
          `,
        )
        .get(
          product.source,
          product.sourceKey,
          product.slug,
          product.title,
          normalizeTitle(product.title),
          product.kind,
          product.productUrl,
          product.coverUrl,
          product.releaseDate,
          product.publisher,
          product.developer,
          product.status,
          timestamp,
          timestamp,
        ) as { id: number }
      productId = row.id
    }

    this.db.prepare('DELETE FROM product_platforms WHERE product_id = ?').run(productId)
    for (const platform of product.platforms) {
      this.db.prepare('INSERT INTO product_platforms (product_id, platform) VALUES (?, ?)').run(productId, platform)
    }

    this.db.prepare('DELETE FROM product_tags WHERE product_id = ?').run(productId)
    for (const tag of product.tags) {
      this.db.prepare('INSERT INTO product_tags (product_id, tag) VALUES (?, ?)').run(productId, tag)
    }

    this.db.prepare('DELETE FROM product_source_ranks WHERE product_id = ?').run(productId)
    for (const rank of product.sourceRanks) {
      this.db
        .prepare('INSERT INTO product_source_ranks (product_id, region, tag, rank) VALUES (?, ?, ?, ?)')
        .run(productId, rank.region, rank.tag, rank.rank)
    }

    let importedOffers = 0
    for (const offer of product.offers) {
      const offerRow = this.db
        .prepare(
          `
          SELECT id FROM offers
          WHERE product_id = ? AND region = ? AND currency = ? AND IFNULL(plus_tier, '') = IFNULL(?, '')
          `,
        )
        .get(productId, offer.region, offer.currency, offer.plusTier) as { id: number } | undefined

      let offerId = offerRow?.id
      if (offerId) {
        this.db
          .prepare(
            `
            UPDATE offers
            SET base_price_minor = ?, discounted_price_minor = ?, discount_percent = ?, sale_start_at = ?,
                sale_end_at = ?, plus_tier = ?, sale_name = ?, availability = ?, source_updated_at = ?,
                last_seen_at = ?, updated_at = ?
            WHERE id = ?
            `,
          )
          .run(
            offer.basePriceMinor,
            offer.discountedPriceMinor,
            offer.discountPercent,
            offer.saleStartAt,
            offer.saleEndAt,
            offer.plusTier,
            offer.saleName,
            offer.availability,
            offer.sourceUpdatedAt,
            timestamp,
            timestamp,
            offerId,
          )
      } else {
        const inserted = this.db
          .prepare(
            `
            INSERT INTO offers (
              product_id, region, currency, base_price_minor, discounted_price_minor,
              discount_percent, sale_start_at, sale_end_at, plus_tier, sale_name,
              availability, source_updated_at, last_seen_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            `,
          )
          .get(
            productId,
            offer.region,
            offer.currency,
            offer.basePriceMinor,
            offer.discountedPriceMinor,
            offer.discountPercent,
            offer.saleStartAt,
            offer.saleEndAt,
            offer.plusTier,
            offer.saleName,
            offer.availability,
            offer.sourceUpdatedAt,
            timestamp,
            timestamp,
            timestamp,
          ) as { id: number }
        offerId = inserted.id
      }

      this.db
        .prepare(
          `
          INSERT INTO price_history (
            product_id, offer_id, checked_at, region, currency, base_price_minor,
            discounted_price_minor, discount_percent, sale_name
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          productId,
          offerId,
          timestamp,
          offer.region,
          offer.currency,
          offer.basePriceMinor,
          offer.discountedPriceMinor,
          offer.discountPercent,
          offer.saleName,
        )

      importedOffers += 1
    }

    return { productId, importedOffers }
  }

  listCatalog(filters: {
    query?: string
    region?: string
    platform?: string
    language?: string
    genre?: string
    kind?: string
    tag?: string
    limit: number
    offset: number
    sort: 'updated' | 'price_asc' | 'price_desc' | 'discount' | 'sony' | 'release_desc' | 'release_asc'
  }) {
    const clauses = ['1 = 1']
    const params: Array<string | number> = []

    if (filters.query) {
      clauses.push('p.title_normalized LIKE ?')
      params.push(`%${filters.query.trim().toLowerCase()}%`)
    }
    if (filters.kind) {
      clauses.push('p.kind = ?')
      params.push(filters.kind)
    }
    if (filters.region) {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM offers o2
          WHERE o2.product_id = p.id
            AND o2.region = ?
            AND COALESCE(o2.discounted_price_minor, o2.base_price_minor, 0) > 0
        )
      `)
      params.push(filters.region)
    } else {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM offers o2
          WHERE o2.product_id = p.id
            AND COALESCE(o2.discounted_price_minor, o2.base_price_minor, 0) > 0
        )
      `)
    }
    if (filters.platform) {
      clauses.push('EXISTS (SELECT 1 FROM product_platforms pp WHERE pp.product_id = p.id AND pp.platform = ?)')
      params.push(filters.platform)
    }
    if (filters.genre) {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM product_details pd
          JOIN json_each(pd.genres_json) genre
          WHERE pd.product_id = p.id
            AND LOWER(genre.value) = LOWER(?)
        )
      `)
      params.push(filters.genre)
    }
    if (filters.language === 'ru_subtitles') {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM product_details pd
          JOIN json_each(pd.screen_languages_json) lang
          WHERE pd.product_id = p.id
            AND ${hasRussianInJsonEach('lang')}
        )
      `)
    }
    if (filters.language === 'ru_full') {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM product_details pd
          WHERE pd.product_id = p.id
            AND EXISTS (
              SELECT 1
              FROM json_each(pd.spoken_languages_json) spoken
              WHERE ${hasRussianInJsonEach('spoken')}
            )
            AND EXISTS (
              SELECT 1
              FROM json_each(pd.screen_languages_json) screen
              WHERE ${hasRussianInJsonEach('screen')}
            )
        )
      `)
    }
    if (filters.tag) {
      clauses.push('EXISTS (SELECT 1 FROM product_tags pt WHERE pt.product_id = p.id AND pt.tag = ?)')
      params.push(filters.tag)
    }

    const bestPriceSql = filters.region
      ? `(
          SELECT MIN(COALESCE(o.discounted_price_minor, o.base_price_minor))
          FROM offers o
          WHERE o.product_id = p.id AND o.region = ?
        )`
      : `(
          SELECT MIN(COALESCE(o.discounted_price_minor, o.base_price_minor))
          FROM offers o
          WHERE o.product_id = p.id
        )`
    const bestPriceParams = filters.region ? [filters.region] : []

    const sourceRankOrder =
      filters.sort === 'sony' && filters.tag
        ? `COALESCE((
            SELECT psr.rank
            FROM product_source_ranks psr
            WHERE psr.product_id = p.id
              AND psr.tag = ?
              ${filters.region ? 'AND psr.region = ?' : ''}
            LIMIT 1
          ), 2147483647) ASC, p.updated_at DESC`
        : null
    const sourceRankParams =
      filters.sort === 'sony' && filters.tag ? [filters.tag, ...(filters.region ? [filters.region] : [])] : []

    const orderBy = sourceRankOrder
      ? sourceRankOrder
      : filters.sort === 'price_asc'
        ? 'best_price ASC, p.updated_at DESC'
        : filters.sort === 'price_desc'
          ? 'best_price DESC, p.updated_at DESC'
          : filters.sort === 'discount'
            ? 'best_discount DESC'
            : filters.sort === 'release_desc'
              ? 'p.release_date DESC, p.updated_at DESC'
              : filters.sort === 'release_asc'
                ? 'p.release_date ASC, p.updated_at DESC'
                : 'p.updated_at DESC'

    const rows = this.db
      .prepare(
        `
        SELECT
          p.*,
          ${bestPriceSql} AS best_price,
          (
            SELECT MAX(o.discount_percent)
            FROM offers o
            WHERE o.product_id = p.id
          ) AS best_discount
        FROM products p
        WHERE ${clauses.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
        `,
      )
      .all(...bestPriceParams, ...params, ...sourceRankParams, filters.limit, filters.offset) as Array<Record<string, unknown>>

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM products p WHERE ${clauses.join(' AND ')}`)
      .get(...params) as { total: number }

    return {
      items: rows.map((row) => this.getCatalogItemFromRow(row)),
      total: totalRow.total,
    }
  }

  getCatalogFilters() {
    const regions = this.db.prepare('SELECT DISTINCT region FROM offers ORDER BY region').all() as Array<{ region: string }>
    const platforms = this.db.prepare('SELECT DISTINCT platform FROM product_platforms ORDER BY platform').all() as Array<{ platform: string }>
    const tags = this.db.prepare('SELECT DISTINCT tag FROM product_tags ORDER BY tag').all() as Array<{ tag: string }>
    const genres = this.db
      .prepare(
        `
        SELECT DISTINCT genre.value AS genre
        FROM product_details pd
        JOIN json_each(pd.genres_json) genre
        WHERE genre.value IS NOT NULL AND TRIM(genre.value) <> ''
        ORDER BY genre.value
        `,
      )
      .all() as Array<{ genre: string }>

    return {
      regions: regions.map((item) => item.region),
      platforms: platforms.map((item) => item.platform),
      tags: tags.map((item) => item.tag),
      genres: genres.map((item) => item.genre),
    }
  }

  getProduct(id: number) {
    const row = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? this.getCatalogItemFromRow(row) : null
  }

  getProductBySlug(slug: string) {
    const row = this.db.prepare('SELECT * FROM products WHERE slug = ?').get(slug) as Record<string, unknown> | undefined
    return row ? this.getCatalogItemFromRow(row) : null
  }

  getProductsByIds(ids: number[]) {
    return ids
      .map((id) => this.getProduct(id))
      .filter((item): item is CatalogListItem => Boolean(item))
  }

  getPsPlusCartProduct(productId: EntityId, fallbackRegion: string): CatalogListItem | null {
    if (typeof productId !== 'string') {
      return null
    }

    const match = /^psplus:(turkey|india):(Essential|Extra|Deluxe):(1|3|12)$/.exec(productId)
    if (!match) {
      return null
    }

    const [, productRegion, tier, durationRaw] = match
    const region = productRegion || fallbackRegion
    const durationMonths = Number(durationRaw) as PsPlusDuration
    const price = new PsPlusPricesService(this.db).get(region, tier as PsPlusTier, durationMonths)
    if (!price?.isActive || price.priceRubMinor === null) {
      return null
    }

    const monthLabel = durationMonths === 1 ? 'месяц' : durationMonths === 3 ? 'месяца' : 'месяцев'
    const title = `PS Plus ${tier} ${durationMonths} ${monthLabel}`
    const offer = toCommercialOffer({
      region,
      currency: 'RUB',
      basePriceMinor: price.priceRubMinor,
      discountedPriceMinor: price.priceRubMinor,
      discountPercent: null,
      saleStartAt: null,
      saleEndAt: null,
      plusTier: tier,
      saleName: null,
      availability: 'available',
      sourceUpdatedAt: price.updatedAt,
    })

    return {
      id: productId,
      source: 'manual',
      sourceKey: productId,
      slug: productId,
      title,
      kind: 'subscription',
      storeType: 'subscription',
      productUrl: '/catalog?category=subscriptions',
      coverUrl: null,
      releaseDate: null,
      publisher: 'AVP Seller',
      developer: null,
      status: 'active',
      hasRussianLanguage: null,
      russianLanguageSupport: 'unknown',
      platforms: ['PS Plus'],
      tags: ['section:subscriptions', `psplus:${tier}`, `duration:${durationMonths}`],
      offers: [offer],
      bestOffer: offer,
    }
  }

  recalculateCart(input: { items: CartInputItem[]; region: string }) {
    const ids = input.items
      .map((item) => item.productId)
      .filter((id): id is number => typeof id === 'number')
    const catalogProducts = this.getProductsByIds(ids)
    const psPlusProducts = input.items
      .map((item) => this.getPsPlusCartProduct(item.productId, input.region))
      .filter((item): item is CatalogListItem => Boolean(item))
    const products = [...catalogProducts, ...psPlusProducts]

    return recalculateTurkeyCart({
      items: input.items,
      products,
      region: input.region,
    })
  }

  createOrder(input: {
    email: string
    region: string
    acceptedOffer: boolean
    comment?: string | null
    items: CartInputItem[]
  }) {
    const timestamp = nowIso()
    const cartSnapshot = this.recalculateCart({
      items: input.items,
      region: input.region,
    })

    const row = this.db
      .prepare(
        `
        INSERT INTO orders (
          email, region, status, accepted_offer, comment, cart_snapshot_json, created_at, updated_at
        )
        VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)
        RETURNING id
        `,
      )
      .get(
        input.email,
        input.region,
        input.acceptedOffer ? 1 : 0,
        input.comment ?? null,
        JSON.stringify(cartSnapshot),
        timestamp,
        timestamp,
      ) as { id: number }

    return this.getOrder(row.id)
  }

  getOrder(id: number): OrderRecord | null {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) {
      return null
    }

    return {
      id: Number(row.id),
      email: String(row.email),
      region: String(row.region),
      status: String(row.status) as OrderRecord['status'],
      acceptedOffer: Number(row.accepted_offer) === 1,
      comment: row.comment === null ? null : String(row.comment),
      cartSnapshot: parseJson(row.cart_snapshot_json, {
        supported: false,
        region: String(row.region),
        sourceItems: [],
        autoCodeItems: [],
        pricing: {
          sourceTotalTryMinor: null,
          sourceTotalRubMinor: 0,
          topUpTotalTryMinor: null,
          topUpTotalRubMinor: null,
          payableRubMinor: 0,
          theoreticalRemainderTryMinor: null,
          rubRate: null,
        },
        message: null,
      }),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  getPriceHistory(id: number, region?: string) {
    if (region) {
      return this.db
        .prepare(
          `
          SELECT checked_at, region, currency, base_price_minor, discounted_price_minor, discount_percent, sale_name
          FROM price_history
          WHERE product_id = ? AND region = ?
          ORDER BY checked_at DESC
          LIMIT 200
          `,
        )
        .all(id, region)
    }

    return this.db
      .prepare(
        `
        SELECT checked_at, region, currency, base_price_minor, discounted_price_minor, discount_percent, sale_name
        FROM price_history
        WHERE product_id = ?
        ORDER BY checked_at DESC
        LIMIT 200
        `,
      )
      .all(id)
  }

  getLatestSyncRuns(limit = 20) {
    return this.db
      .prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?')
      .all(limit)
  }

  getProductTranslation(productId: number, field: string, locale: string, sourceHash: string) {
    const row = this.db
      .prepare(
        `
        SELECT text
        FROM product_translations
        WHERE product_id = ? AND field = ? AND locale = ? AND source_hash = ?
        `,
      )
      .get(productId, field, locale, sourceHash) as { text: string } | undefined

    return row?.text ?? null
  }

  upsertProductTranslation(input: {
    productId: number
    field: string
    locale: string
    sourceHash: string
    text: string
  }) {
    this.db
      .prepare(
        `
        INSERT INTO product_translations (product_id, field, locale, source_hash, text, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id, field, locale) DO UPDATE SET
          source_hash = excluded.source_hash,
          text = excluded.text,
          updated_at = excluded.updated_at
        `,
      )
      .run(input.productId, input.field, input.locale, input.sourceHash, input.text, nowIso())
  }

  listProductsForDetailEnrichment(limit?: number) {
    const query = `
      SELECT
        p.id,
        p.source_key,
        CASE
          WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = 'turkey') THEN 'en-tr'
          WHEN EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = 'india') THEN 'en-in'
          ELSE 'en-in'
        END AS locale
      FROM products p
      WHERE p.source = 'playstation-store'
        AND p.kind IN ('game', 'bundle', 'edition')
        AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.region = 'turkey')
      ORDER BY p.id
      ${typeof limit === 'number' ? 'LIMIT ?' : ''}
    `

    const rows =
      typeof limit === 'number'
        ? (this.db.prepare(query).all(limit) as Array<{ id: number; source_key: string; locale: string }>)
        : (this.db.prepare(query).all() as Array<{ id: number; source_key: string; locale: string }>)

    return rows
  }

  upsertEditionProductsFromDetail(parentProductId: number, detail: ImportedProductDetail) {
    const parent = this.db.prepare('SELECT * FROM products WHERE id = ?').get(parentProductId) as
      | Record<string, unknown>
      | undefined

    if (!parent) {
      return { products: 0, offers: 0 }
    }

    const region = detail.locale === 'en-tr' ? 'turkey' : detail.locale === 'en-in' ? 'india' : null
    const parentPlatforms = this.db
      .prepare('SELECT platform FROM product_platforms WHERE product_id = ? ORDER BY platform')
      .all(parentProductId) as Array<{ platform: string }>
    const parentTags = this.db
      .prepare('SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag')
      .all(parentProductId) as Array<{ tag: string }>
    const parentRanks = this.db
      .prepare('SELECT region, tag, rank FROM product_source_ranks WHERE product_id = ? ORDER BY region, tag')
      .all(parentProductId) as Array<Record<string, unknown>>
    const sourceRanks: ProductSourceRank[] = parentRanks.map((rank) => ({
      region: String(rank.region),
      tag: String(rank.tag),
      rank: Number(rank.rank),
    }))

    let products = 0
    let offers = 0

    for (const edition of detail.editions) {
      const price = edition.price
      const hasPrice = price.discountedPriceMinor !== null || price.basePriceMinor !== null
      if (!region || !price.currency || !hasPrice) {
        continue
      }

      const title = edition.title || edition.editionName || String(parent.title)
      const upserted = this.upsertProduct({
        source: String(parent.source),
        sourceKey: edition.sourceKey,
        slug: toSlug(title || edition.sourceKey) || edition.sourceKey.toLowerCase(),
        title,
        kind: edition.sourceKey === String(parent.source_key) ? (parent.kind as ProductKind) : 'edition',
        productUrl: `https://store.playstation.com/${detail.locale}/product/${edition.sourceKey}`,
        coverUrl: edition.coverUrl ?? (parent.cover_url === null ? null : String(parent.cover_url)),
        releaseDate: detail.releaseDate ?? (parent.release_date === null ? null : String(parent.release_date)),
        publisher: detail.publisherName ?? (parent.publisher === null ? null : String(parent.publisher)),
        developer: parent.developer === null ? null : String(parent.developer),
        status: 'active',
        platforms: parentPlatforms.map((item) => item.platform),
        tags: parentTags.map((item) => item.tag),
        sourceRanks,
        offers: [
          {
            region,
            currency: price.currency,
            basePriceMinor: price.basePriceMinor,
            discountedPriceMinor: price.discountedPriceMinor,
            discountPercent: price.discountPercent,
            saleStartAt: null,
            saleEndAt: detail.saleEndAt,
            plusTier: null,
            saleName: null,
            availability: 'available',
            sourceUpdatedAt: detail.sourceUpdatedAt,
          },
        ],
      })

      const isCurrentEdition = edition.sourceKey === detail.sourceKey
      const existingDetail = this.getProductDetail(upserted.productId)

      this.upsertProductDetail(upserted.productId, {
        ...detail,
        sourceKey: edition.sourceKey,
        editionName: edition.editionName,
        masterImageUrl: edition.coverUrl ?? detail.masterImageUrl,
        longDescription: edition.longDescription ?? (isCurrentEdition ? detail.longDescription : existingDetail?.longDescription ?? null),
        compatibilityNotice: edition.compatibilityNotice ?? (isCurrentEdition ? detail.compatibilityNotice : existingDetail?.compatibilityNotice ?? null),
        legalText: edition.legalText ?? (isCurrentEdition ? detail.legalText : existingDetail?.legalText ?? null),
      })

      products += 1
      offers += upserted.importedOffers
    }

    return { products, offers }
  }

  upsertStoredEditionProducts(parentProductId: number) {
    const parent = this.db.prepare('SELECT source_key FROM products WHERE id = ?').get(parentProductId) as
      | { source_key: string }
      | undefined
    const detail = this.getProductDetail(parentProductId)

    if (!parent || !detail) {
      return { products: 0, offers: 0 }
    }

    return this.upsertEditionProductsFromDetail(parentProductId, {
      sourceKey: parent.source_key,
      locale: detail.locale,
      releaseDate: detail.releaseDate,
      editionName: detail.editionName,
      publisherName: detail.publisherName,
      topCategory: detail.topCategory,
      privacyPolicy: detail.privacyPolicy,
      contentRating: detail.contentRating,
      heroBackgroundUrl: detail.heroBackgroundUrl,
      logoUrl: detail.logoUrl,
      masterImageUrl: detail.masterImageUrl,
      longDescription: detail.longDescription,
      compatibilityNotice: detail.compatibilityNotice,
      legalText: detail.legalText,
      genres: detail.genres,
      spokenLanguages: detail.spokenLanguages,
      screenLanguages: detail.screenLanguages,
      compatibility: detail.compatibility,
      rating: detail.rating,
      media: detail.media,
      editions: detail.editions,
      addOns: detail.addOns,
      saleEndAt: detail.saleEndAt,
      lowestRecentPrice: detail.lowestRecentPrice,
      sourceUpdatedAt: detail.sourceUpdatedAt,
    })
  }

  upsertProductDetail(productId: number, detail: ImportedProductDetail) {
    const timestamp = nowIso()

    this.db
      .prepare(
        `
        INSERT INTO product_details (
          product_id, locale, release_date, edition_name, publisher_name, top_category,
          privacy_policy, content_rating, hero_background_url, logo_url, master_image_url,
          long_description, compatibility_notice, legal_text, genres_json, spoken_languages_json,
          screen_languages_json, compatibility_json, rating_json, media_json, editions_json, add_ons_json,
          sale_end_at, lowest_recent_price, source_updated_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id) DO UPDATE SET
          locale = excluded.locale,
          release_date = excluded.release_date,
          edition_name = excluded.edition_name,
          publisher_name = excluded.publisher_name,
          top_category = excluded.top_category,
          privacy_policy = excluded.privacy_policy,
          content_rating = excluded.content_rating,
          hero_background_url = excluded.hero_background_url,
          logo_url = excluded.logo_url,
          master_image_url = excluded.master_image_url,
          long_description = excluded.long_description,
          compatibility_notice = excluded.compatibility_notice,
          legal_text = excluded.legal_text,
          genres_json = excluded.genres_json,
          spoken_languages_json = excluded.spoken_languages_json,
          screen_languages_json = excluded.screen_languages_json,
          compatibility_json = excluded.compatibility_json,
          rating_json = excluded.rating_json,
          media_json = excluded.media_json,
          editions_json = excluded.editions_json,
          add_ons_json = excluded.add_ons_json,
          sale_end_at = excluded.sale_end_at,
          lowest_recent_price = excluded.lowest_recent_price,
          source_updated_at = excluded.source_updated_at,
          updated_at = excluded.updated_at
        `,
      )
      .run(
        productId,
        detail.locale,
        detail.releaseDate,
        detail.editionName,
        detail.publisherName,
        detail.topCategory,
        detail.privacyPolicy,
        detail.contentRating,
        detail.heroBackgroundUrl,
        detail.logoUrl,
        detail.masterImageUrl,
        detail.longDescription,
        detail.compatibilityNotice,
        detail.legalText,
        JSON.stringify(detail.genres),
        JSON.stringify(detail.spokenLanguages),
        JSON.stringify(detail.screenLanguages),
        JSON.stringify(detail.compatibility),
        JSON.stringify(detail.rating),
        JSON.stringify(detail.media),
        JSON.stringify(detail.editions),
        JSON.stringify(detail.addOns),
        detail.saleEndAt,
        detail.lowestRecentPrice,
        detail.sourceUpdatedAt,
        timestamp,
      )

    this.db
      .prepare(
        `
        UPDATE products
        SET release_date = COALESCE(?, release_date),
            publisher = COALESCE(?, publisher),
            updated_at = ?
        WHERE id = ?
        `,
      )
      .run(detail.releaseDate, detail.publisherName, timestamp, productId)

    if (detail.saleEndAt) {
      const region = detail.locale === 'en-tr' ? 'turkey' : 'india'
      this.db
        .prepare(
          `
          UPDATE offers
          SET sale_end_at = ?, updated_at = ?
          WHERE product_id = ? AND region = ?
          `,
        )
        .run(detail.saleEndAt, timestamp, productId, region)
    }
  }

  getProductDetail(productId: number): CatalogProductDetail | null {
    const row = this.db.prepare('SELECT * FROM product_details WHERE product_id = ?').get(productId) as
      | Record<string, unknown>
      | undefined

    if (!row) {
      return null
    }

    const spokenLanguages = parseJson<string[]>(row.spoken_languages_json, [])
    const screenLanguages = parseJson<string[]>(row.screen_languages_json, [])
    const editions = parseJson<CatalogProductDetail['editions']>(row.editions_json, [])
      .filter((edition) => edition.price.discountedPriceMinor !== null || edition.price.basePriceMinor !== null)
      .map((edition) => {
        const productRow = this.db.prepare('SELECT id FROM products WHERE source_key = ?').get(edition.sourceKey) as
          | { id: number }
          | undefined

        return {
          ...edition,
          productId: productRow?.id ?? null,
        }
      })

    return {
      productId,
      locale: String(row.locale),
      releaseDate: row.release_date === null ? null : String(row.release_date),
      editionName: row.edition_name === null ? null : String(row.edition_name),
      publisherName: row.publisher_name === null ? null : String(row.publisher_name),
      topCategory: row.top_category === null ? null : String(row.top_category),
      privacyPolicy: row.privacy_policy === null ? null : String(row.privacy_policy),
      contentRating: row.content_rating === null ? null : String(row.content_rating),
      heroBackgroundUrl: row.hero_background_url === null ? null : String(row.hero_background_url),
      logoUrl: row.logo_url === null ? null : String(row.logo_url),
      masterImageUrl: row.master_image_url === null ? null : String(row.master_image_url),
      longDescription: row.long_description === null ? null : String(row.long_description),
      compatibilityNotice: row.compatibility_notice === null ? null : String(row.compatibility_notice),
      legalText: row.legal_text === null ? null : String(row.legal_text),
      genres: parseJson<string[]>(row.genres_json, []),
      spokenLanguages,
      screenLanguages,
      compatibility: parseJson<CatalogProductDetail['compatibility']>(row.compatibility_json, {}),
      rating: parseJson<CatalogProductDetail['rating']>(row.rating_json, {
        averageRating: null,
        totalRatingsCount: null,
        distribution: [],
      }),
      media: parseJson<CatalogProductDetail['media']>(row.media_json, []),
      editions,
      addOns: parseJson<CatalogProductDetail['addOns']>(row.add_ons_json, []),
      saleEndAt: row.sale_end_at === null ? null : String(row.sale_end_at),
      lowestRecentPrice: row.lowest_recent_price === null ? null : String(row.lowest_recent_price),
      sourceUpdatedAt: String(row.source_updated_at),
      hasRussianLanguage: hasRussianLanguage([...spokenLanguages, ...screenLanguages]),
      russianLanguageSupport: getRussianLanguageSupport(spokenLanguages, screenLanguages),
    }
  }

  private getCatalogItemFromRow(row: Record<string, unknown>): CatalogListItem {
    const productId = Number(row.id)
    const platforms = this.db
      .prepare('SELECT platform FROM product_platforms WHERE product_id = ? ORDER BY platform')
      .all(productId) as Array<{ platform: string }>
    const tags = this.db
      .prepare('SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag')
      .all(productId) as Array<{ tag: string }>
    const offers = this.db
      .prepare('SELECT * FROM offers WHERE product_id = ? ORDER BY region, currency')
      .all(productId) as Array<Record<string, unknown>>
    const detailRow = this.db
      .prepare('SELECT spoken_languages_json, screen_languages_json FROM product_details WHERE product_id = ?')
      .get(productId) as Record<string, unknown> | undefined

    const spokenLanguages = detailRow ? parseJson<string[]>(detailRow.spoken_languages_json, []) : []
    const screenLanguages = detailRow ? parseJson<string[]>(detailRow.screen_languages_json, []) : []

    const mappedOffers = offers.map((offer) => toCommercialOffer(mapOffer(offer)))
    const bestOffer =
      mappedOffers
        .slice()
        .sort((left, right) => {
          const leftPrice = left.priceRubMinor ?? left.priceSourceMinor ?? Number.MAX_SAFE_INTEGER
          const rightPrice = right.priceRubMinor ?? right.priceSourceMinor ?? Number.MAX_SAFE_INTEGER
          return leftPrice - rightPrice
        })[0] ?? null

    return {
      id: productId,
      source: String(row.source),
      sourceKey: String(row.source_key),
      slug: String(row.slug),
      title: String(row.title),
      kind: row.kind as CatalogListItem['kind'],
      storeType: deriveStoreType(row.kind as CatalogListItem['kind'], tags.map((item) => item.tag)),
      productUrl: String(row.product_url),
      coverUrl: row.cover_url === null ? null : String(row.cover_url),
      releaseDate: row.release_date === null ? null : String(row.release_date),
      publisher: row.publisher === null ? null : String(row.publisher),
      developer: row.developer === null ? null : String(row.developer),
      status: row.status as ProductStatus,
      hasRussianLanguage: hasRussianLanguage([...spokenLanguages, ...screenLanguages]),
      russianLanguageSupport: getRussianLanguageSupport(spokenLanguages, screenLanguages),
      platforms: platforms.map((item) => item.platform),
      tags: tags.map((item) => item.tag),
      offers: mappedOffers,
      bestOffer,
    }
  }
}
