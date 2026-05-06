import type {
  CatalogProvider,
  ImportedProduct,
  ImportedProductDetail,
  ImportOffer,
  ProductKind,
  ProductSourceRank,
  ProviderContext,
} from '../types'

interface RegionConfig {
  region: 'india' | 'turkey'
  locale: 'en-in' | 'en-tr'
  currency: 'INR' | 'TRY'
}

interface SourceConfig {
  name: 'deals' | 'preorders' | 'subscriptions' | 'games'
  kind: 'category' | 'page'
  path: string
  tags: string[]
  itemLimitByRegion?: Partial<Record<RegionConfig['region'], number>>
}

interface CategoryGridResult {
  products: CategoryGridProduct[]
  isLast: boolean
  pageInfo: {
    totalCount: number | null
    size: number
  }
}

interface NextData {
  props?: {
    apolloState?: Record<string, unknown>
    pageProps?: {
      locale?: string
      batarangs?: Record<string, { text?: string; statusCode?: number }>
    }
  }
}

interface CategoryGridProduct {
  id: string
  name: string
  price?: {
    basePrice?: string | null
    discountedPrice?: string | null
    discountText?: string | null
    isExclusive?: boolean
    serviceBranding?: string[]
    upsellServiceBranding?: string[]
    upsellText?: string | null
  }
  platforms?: string[]
  storeDisplayClassification?: string
  media?: Array<{
    type?: string
    role?: string
    url?: string
  }>
}

interface ConceptGridEntry {
  id: string
  name: string
  price?: CategoryGridProduct['price']
  media?: CategoryGridProduct['media']
  products?: Array<{
    __ref?: string
  }>
}

interface ProductAccumulator {
  source: string
  sourceKey: string
  slug: string
  title: string
  kind: ProductKind
  productUrl: string
  coverUrl: string | null
  releaseDate: string | null
  publisher: string | null
  developer: string | null
  status: 'active'
  platforms: Set<string>
  tags: Set<string>
  sourceRanks: Map<string, ProductSourceRank>
  offers: Map<string, ImportOffer>
}

type CompatibilityMap = Record<string, Array<{ type: string; value: string }>>

interface ParsedEnv {
  cache: Record<string, unknown>
}

type HtmlFetcher = (url: string) => Promise<string>

const REGION_CONFIGS: RegionConfig[] = [
  { region: 'india', locale: 'en-in', currency: 'INR' },
  { region: 'turkey', locale: 'en-tr', currency: 'TRY' },
]

const REGION_BY_LOCALE = new Map(REGION_CONFIGS.map((item) => [item.locale, item]))

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    name: 'deals',
    kind: 'category',
    path: '/category/3f772501-f6f8-49b7-abac-874a88ca4897',
    tags: ['section:deals', 'store:discounts'],
  },
  {
    name: 'preorders',
    kind: 'category',
    path: '/category/3bf499d7-7acf-4931-97dd-2667494ee2c9',
    tags: ['section:preorders', 'store:preorder'],
  },
  {
    name: 'subscriptions',
    kind: 'page',
    path: '/pages/subscriptions',
    tags: ['section:subscriptions', 'store:subscriptions'],
  },
  {
    name: 'games',
    kind: 'category',
    path: '/category/28c9c2b2-cecc-415c-9a08-482a605cb104',
    tags: ['section:games', 'store:games', 'section:ps-store'],
    itemLimitByRegion: {
      turkey: 10000,
      india: 10000,
    },
  },
]

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getEnabledRegions() {
  const raw = process.env.PLAYSTATION_REGIONS
  if (!raw) {
    return REGION_CONFIGS
  }

  const requested = new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )

  const regions = REGION_CONFIGS.filter(
    (item) => requested.has(item.region) || requested.has(item.locale) || requested.has(item.region === 'turkey' ? 'tr' : 'in'),
  )

  return regions.length > 0 ? regions : REGION_CONFIGS
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripHtml(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function parseMinorPrice(raw: string | null | undefined, currency: RegionConfig['currency']) {
  if (!raw) {
    return null
  }

  const normalized = raw
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d,.\s]/g, '')
    .trim()

  if (!normalized) {
    return null
  }

  if (currency === 'TRY') {
    const decimal = normalized.replace(/\./g, '').replace(',', '.').replace(/\s+/g, '')
    const amount = Number(decimal)
    return Number.isFinite(amount) ? Math.round(amount * 100) : null
  }

  const numeric = normalized.replace(/,/g, '').replace(/\s+/g, '')
  const amount = Number(numeric)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

function parseDiscountPercent(raw: string | null | undefined) {
  if (!raw) {
    return null
  }

  const match = raw.match(/-?(\d+)/)
  return match ? Number(match[1]) : null
}

function mapKind(value: string | undefined, tags: Set<string>): ProductKind {
  switch (value) {
    case 'FULL_GAME':
      return 'game'
    case 'GAME_BUNDLE':
      return 'bundle'
    case 'PREMIUM_EDITION':
    case 'EDITION':
      return 'edition'
    case 'VIRTUAL_CURRENCY':
      return 'currency'
    case 'SUBSCRIPTION':
      return 'subscription'
    default:
      if (tags.has('section:subscriptions')) {
        return 'subscription'
      }

      if (tags.has('store:games') || tags.has('section:popular') || tags.has('section:games')) {
        return 'game'
      }

      return 'add-on'
  }
}

function pickCoverUrl(media: CategoryGridProduct['media']) {
  const imageItems = (media ?? []).filter((item) => item.type === 'IMAGE' && item.url)
  const preferredRoles = ['MASTER', 'GAMEHUB_COVER_ART', 'PORTRAIT_BANNER', 'FOUR_BY_THREE_BANNER', 'EDITION_KEY_ART']

  for (const role of preferredRoles) {
    const match = imageItems.find((item) => item.role === role)
    if (match?.url) {
      return match.url
    }
  }

  return imageItems[0]?.url ?? null
}

function buildOffer(product: CategoryGridProduct, region: RegionConfig): ImportOffer {
  return {
    region: region.region,
    currency: region.currency,
    basePriceMinor: parseMinorPrice(product.price?.basePrice ?? null, region.currency),
    discountedPriceMinor: parseMinorPrice(product.price?.discountedPrice ?? null, region.currency),
    discountPercent: parseDiscountPercent(product.price?.discountText ?? null),
    saleStartAt: null,
    saleEndAt: null,
    plusTier: null,
    saleName: null,
    availability: 'available',
    sourceUpdatedAt: new Date().toISOString(),
  }
}

function currentOfferMinor(offer: ImportOffer) {
  return offer.discountedPriceMinor ?? offer.basePriceMinor ?? Number.MAX_SAFE_INTEGER
}

function chooseBetterOffer(current: ImportOffer | undefined, next: ImportOffer) {
  if (!current) {
    return next
  }

  if (next.discountedPriceMinor !== null && current.discountedPriceMinor === null) {
    return next
  }

  if (next.discountPercent !== null && current.discountPercent === null) {
    return next
  }

  if (next.discountedPriceMinor !== null && current.discountedPriceMinor !== null) {
    return currentOfferMinor(next) < currentOfferMinor(current) ? next : current
  }

  if (current.basePriceMinor === null && next.basePriceMinor !== null) {
    return next
  }

  return current
}

function mergeTags(base: Set<string>, sourceTags: string[], product: CategoryGridProduct) {
  for (const tag of sourceTags) {
    base.add(tag)
  }

  for (const platform of product.platforms ?? []) {
    base.add(`platform:${platform.toLowerCase()}`)
  }

  if (product.storeDisplayClassification) {
    base.add(`classification:${product.storeDisplayClassification.toLowerCase()}`)
  }

  if ((product.price?.discountedPrice ?? null) && product.price?.discountText) {
    base.add('pricing:discounted')
  }

  if (product.price?.isExclusive) {
    base.add('pricing:exclusive')
  }

  if (product.price?.upsellText) {
    base.add(`upsell:${toSlug(product.price.upsellText)}`)
  }

  for (const brand of product.price?.serviceBranding ?? []) {
    if (brand && brand !== 'NONE') {
      base.add(`service:${brand.toLowerCase()}`)
    }
  }

  for (const brand of product.price?.upsellServiceBranding ?? []) {
    if (brand && brand !== 'NONE') {
      base.add(`upsell-service:${brand.toLowerCase()}`)
    }
  }
}

function extractEnvJsons(html: string) {
  return [...html.matchAll(/<script id="env:[^"]+" type="application\/json">([\s\S]*?)<\/script>/g)].map((match) =>
    JSON.parse(match[1]) as ParsedEnv,
  )
}

function mergeCaches(envs: ParsedEnv[]) {
  const merged: Record<string, unknown> = {}
  for (const env of envs) {
    for (const [key, value] of Object.entries(asObject(env.cache))) {
      if (key in merged && typeof merged[key] === 'object' && typeof value === 'object') {
        merged[key] = {
          ...asObject(merged[key]),
          ...asObject(value),
        }
      } else {
        merged[key] = value
      }
    }
  }
  return merged
}

function getDescriptions(product: Record<string, unknown>) {
  return asArray(product.descriptions).map((item) => asObject(item))
}

function parseProductRefId(value: string | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^Product:(.+?)(?::[a-z]{2}-[a-z]{2})?$/i)
  return match ? match[1] : null
}

function extractSkuId(value: unknown) {
  const ref = String(asObject(value).__ref ?? '')
  const match = ref.match(/^Sku:(.+)$/)
  return match ? match[1] : null
}

function getProductSkuIds(product: Record<string, unknown>) {
  return asArray(product.skus).map(extractSkuId).filter((item): item is string => Boolean(item))
}

function getCtaSku(cta: Record<string, unknown>) {
  const local = asObject(cta.local)
  const dataTrack = asObject(local.ctaDataTrack)
  const sku = dataTrack.sku
  if (sku) {
    return String(sku)
  }

  const id = String(cta.id ?? '')
  const match = id.match(/:([A-Z0-9-]+-E\d+):OUTRIGHT/i)
  return match ? match[1] : null
}

function extractProductCtaPrice(product: Record<string, unknown>, mergedCaches: Record<string, unknown>, region: RegionConfig) {
  const skuIds = new Set(getProductSkuIds(product))
  const ctas = Object.values(mergedCaches)
    .map((item) => asObject(item))
    .filter((item) => item.__typename === 'GameCTA' && skuIds.has(getCtaSku(item) ?? ''))

  for (const cta of ctas) {
    const local = asObject(cta.local)
    const priceOrText = local.priceOrText ? String(local.priceOrText) : null
    const originalPrice = local.originalPrice ? String(local.originalPrice) : null
    const discountedPriceMinor = parseMinorPrice(priceOrText, region.currency)
    const basePriceMinor = parseMinorPrice(originalPrice, region.currency) ?? discountedPriceMinor

    if (discountedPriceMinor !== null || basePriceMinor !== null) {
      return {
        currency: region.currency,
        basePriceMinor,
        discountedPriceMinor,
        discountPercent: parseDiscountPercent(local.offerLabel ? String(local.offerLabel) : null),
      }
    }
  }

  return {
    currency: region.currency,
    basePriceMinor: null,
    discountedPriceMinor: null,
    discountPercent: null,
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  batchDelayMs = 0,
) {
  const results = new Array<R>(items.length)

  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency)
    const batchResults = await Promise.all(batch.map((item, batchIndex) => mapper(item, index + batchIndex)))
    for (const [batchIndex, result] of batchResults.entries()) {
      results[index + batchIndex] = result
    }

    if (batchDelayMs > 0 && index + concurrency < items.length) {
      await sleep(batchDelayMs)
    }
  }

  return results
}

export class PlayStationStoreProvider implements CatalogProvider {
  name = 'playstation-store'

  constructor(private readonly htmlFetcher?: HtmlFetcher) {}

  async fetchProducts(context: ProviderContext): Promise<ImportedProduct[]> {
    void context
    const products = new Map<string, ProductAccumulator>()

    for (const region of getEnabledRegions()) {
      for (const source of SOURCE_CONFIGS) {
        if (source.kind === 'category') {
          const items = await this.fetchCategorySource(region, source)
          for (const [index, item] of items.entries()) {
            this.mergeProduct(products, item, source.tags, region, index + 1)
          }
          continue
        }

        const items = await this.fetchPageSource(region, source)
        for (const [index, item] of items.entries()) {
          this.mergeProduct(products, item, source.tags, region, index + 1)
        }
      }
    }

    return [...products.values()].map((item) => ({
      source: item.source,
      sourceKey: item.sourceKey,
      slug: item.slug,
      title: item.title,
      kind: item.kind,
      productUrl: item.productUrl,
      coverUrl: item.coverUrl,
      releaseDate: item.releaseDate,
      publisher: item.publisher,
      developer: item.developer,
      status: item.status,
      platforms: [...item.platforms].sort(),
      tags: [...item.tags].sort(),
      sourceRanks: [...item.sourceRanks.values()].sort((left, right) => {
        const regionComparison = left.region.localeCompare(right.region)
        return regionComparison === 0 ? left.rank - right.rank : regionComparison
      }),
      offers: [...item.offers.values()].sort((left, right) => left.region.localeCompare(right.region)),
    }))
  }

  async fetchProductDetail(productId: string, locale: string): Promise<ImportedProductDetail> {
    const normalizedLocale = locale as RegionConfig['locale']
    const region = REGION_BY_LOCALE.get(normalizedLocale)
    if (!region) {
      throw new Error(`Unsupported PlayStation Store locale: ${locale}`)
    }

    const url = `https://store.playstation.com/${normalizedLocale}/product/${productId}`
    const nextData = await this.fetchNextData(url)
    const batarangs = nextData.props?.pageProps?.batarangs ?? {}
    const mergedCaches = mergeCaches(
      Object.values(batarangs)
        .filter((entry) => typeof entry?.text === 'string')
        .flatMap((entry) => extractEnvJsons(entry.text!)),
    )

    const product = asObject(mergedCaches[`Product:${productId}`])
    if (!product.id) {
      throw new Error(`Unable to extract product detail payload for ${productId} (${locale})`)
    }

    const descriptions = getDescriptions(product)
    const compatibilityMap = asObject(product.compatibilityNoticesByPlatform)
    const starRating = asObject(product.starRating)
    const media = asArray(product.personalizedMeta ? asObject(product.personalizedMeta).media : product.media)
      .map((item) => asObject(item))
      .filter((item) => item.url)
      .map((item) => ({
        role: item.role ? String(item.role) : null,
        type: item.type ? String(item.type) : null,
        url: String(item.url),
      }))

    const addOns = Object.entries(mergedCaches)
      .filter(([key, value]) => key.startsWith('Product:') && key !== `Product:${productId}` && asObject(value).id)
      .map(([, value]) => {
        const addOn = asObject(value)
        const addOnPrice = asObject(addOn.price)
        const addOnTags = new Set<string>()
        return {
          sourceKey: String(addOn.id),
          title: String(addOn.name ?? addOn.invariantName ?? addOn.id),
          kind: mapKind(addOn.storeDisplayClassification ? String(addOn.storeDisplayClassification) : undefined, addOnTags),
          coverUrl: addOn.boxArt ? String(asObject(addOn.boxArt).url ?? '') || null : pickCoverUrl(asArray(addOn.media) as CategoryGridProduct['media']),
          price: {
            currency: region.currency,
            basePriceMinor: parseMinorPrice(addOnPrice.basePrice ? String(addOnPrice.basePrice) : null, region.currency),
            discountedPriceMinor: parseMinorPrice(
              addOnPrice.discountedPrice ? String(addOnPrice.discountedPrice) : null,
              region.currency,
            ),
            discountPercent: parseDiscountPercent(addOnPrice.discountText ? String(addOnPrice.discountText) : null),
          },
        }
      })

    const conceptProducts = Object.values(mergedCaches)
      .map((item) => asObject(item))
      .find((item) =>
        asArray(item.products)
          .map((entry) => parseProductRefId(asObject(entry).__ref ? String(asObject(entry).__ref) : undefined))
          .includes(productId),
      )
    const editionRefs = asArray(conceptProducts?.products)
      .map((entry) => parseProductRefId(asObject(entry).__ref ? String(asObject(entry).__ref) : undefined))
      .filter((item): item is string => Boolean(item))
    const editions = editionRefs
      .map((sourceKey) => asObject(mergedCaches[`Product:${sourceKey}`]))
      .filter((editionProduct) => editionProduct.id && editionProduct.topCategory === 'GAME')
      .map((editionProduct) => {
        const edition = asObject(editionProduct.edition)
        const editionDescriptions = getDescriptions(editionProduct)
        const ordering = edition.ordering === null || edition.ordering === undefined ? 0 : Number(edition.ordering)
        return {
          edition: {
            sourceKey: String(editionProduct.id),
            title: String(editionProduct.name ?? editionProduct.invariantName ?? editionProduct.id),
            editionName: edition.name ? String(edition.name) : null,
            features: asArray(edition.features).map(String).filter(Boolean),
            coverUrl: editionProduct.boxArt
              ? String(asObject(editionProduct.boxArt).url ?? '') || null
              : pickCoverUrl(asArray(editionProduct.media) as CategoryGridProduct['media']),
            longDescription:
              stripHtml(
                editionDescriptions.find((item) => item.type === 'LONG' && (item.subType === 'NONE' || item.subType === null))?.value as
                  | string
                  | undefined,
              ) ?? null,
            compatibilityNotice:
              stripHtml(
                editionDescriptions.find((item) => item.type === 'COMPATIBILITY_NOTICE')?.value as string | undefined,
              ) ?? null,
            legalText:
              stripHtml(
                editionDescriptions
                  .filter((item) => item.type === 'LEGAL')
                  .map((item) => String(item.value ?? ''))
                  .join('\n\n'),
              ) ?? null,
            price: extractProductCtaPrice(editionProduct, mergedCaches, region),
          },
          ordering: Number.isFinite(ordering) ? ordering : 0,
        }
      })
      .sort((left, right) => left.ordering - right.ordering)
      .map((item) => item.edition)

    const cta = Object.values(mergedCaches)
      .map((item) => asObject(item))
      .find((item) => item.__typename === 'GameCTA' && asObject(item.price).currencyCode)
    const ctaPrice = asObject(cta?.price)
    const saleEndRaw = ctaPrice.endTime ? Number(ctaPrice.endTime) : null

    return {
      sourceKey: productId,
      locale: normalizedLocale,
      releaseDate: product.releaseDate ? String(product.releaseDate) : null,
      editionName: product.edition ? String(asObject(product.edition).name ?? '') || null : null,
      publisherName: product.publisherName ? String(product.publisherName) : null,
      topCategory: product.topCategory ? String(product.topCategory) : null,
      privacyPolicy: product.privacyPolicy ? String(product.privacyPolicy) : null,
      contentRating: product.contentRating ? String(asObject(product.contentRating).name ?? '') || null : null,
      heroBackgroundUrl: media.find((item) => item.role === 'BACKGROUND')?.url ?? null,
      logoUrl: media.find((item) => item.role === 'LOGO')?.url ?? null,
      masterImageUrl: media.find((item) => item.role === 'MASTER')?.url ?? null,
      longDescription:
        stripHtml(
          descriptions.find((item) => item.type === 'LONG' && (item.subType === 'NONE' || item.subType === null))?.value as
            | string
            | undefined,
        ) ?? null,
      compatibilityNotice:
        stripHtml(
          descriptions.find((item) => item.type === 'COMPATIBILITY_NOTICE')?.value as string | undefined,
        ) ?? null,
      legalText:
        stripHtml(
          descriptions
            .filter((item) => item.type === 'LEGAL')
            .map((item) => String(item.value ?? ''))
            .join('\n\n'),
        ) ?? null,
      genres: asArray(product.localizedGenres)
        .map((item) => String(asObject(item).value ?? ''))
        .filter(Boolean),
      spokenLanguages: asArray(product.spokenLanguages).map(String).filter(Boolean),
      screenLanguages: asArray(product.screenLanguages).map(String).filter(Boolean),
      compatibility: Object.fromEntries(
        Object.entries(compatibilityMap)
          .filter(([key]) => key !== '__typename')
          .map(([key, value]) => [
            key,
            asArray(value).map((item) => {
              const notice = asObject(item)
              return {
                type: String(notice.type ?? ''),
                value: String(notice.value ?? ''),
              }
            }),
          ]),
      ) as CompatibilityMap,
      rating: {
        averageRating: starRating.averageRating === undefined ? null : Number(starRating.averageRating),
        totalRatingsCount: starRating.totalRatingsCount === undefined ? null : Number(starRating.totalRatingsCount),
        distribution: asArray(starRating.ratingsDistribution).map((item) => {
          const entry = asObject(item)
          return {
            rating: Number(entry.rating ?? 0),
            percentage: Number(entry.percentageRaw ?? 0),
          }
        }),
      },
      media,
      editions,
      addOns,
      saleEndAt: saleEndRaw && Number.isFinite(saleEndRaw) ? new Date(saleEndRaw).toISOString() : null,
      lowestRecentPrice:
        ctaPrice.history && asObject(ctaPrice.history).lowestRecentPrice
          ? String(asObject(ctaPrice.history).lowestRecentPrice)
          : null,
      sourceUpdatedAt: new Date().toISOString(),
    }
  }

  private mergeProduct(
    target: Map<string, ProductAccumulator>,
    product: CategoryGridProduct,
    sourceTags: string[],
    region: RegionConfig,
    rank: number,
  ) {
    const sourceKey = product.id
    const tags = new Set<string>()
    mergeTags(tags, sourceTags, product)

    const current =
      target.get(sourceKey) ??
      ({
        source: this.name,
        sourceKey,
        slug: toSlug(product.name || product.id),
        title: product.name || product.id,
        kind: mapKind(product.storeDisplayClassification, tags),
        productUrl: `https://store.playstation.com/product/${product.id}`,
        coverUrl: pickCoverUrl(product.media),
        releaseDate: null,
        publisher: null,
        developer: null,
        status: 'active',
        platforms: new Set<string>(),
        tags: new Set<string>(),
        sourceRanks: new Map<string, ProductSourceRank>(),
        offers: new Map<string, ImportOffer>(),
      }) satisfies ProductAccumulator

    current.title = current.title || product.name || product.id
    current.slug = current.slug || toSlug(product.name || product.id)
    current.kind = current.kind === 'add-on' ? mapKind(product.storeDisplayClassification, tags) : current.kind
    current.coverUrl = current.coverUrl ?? pickCoverUrl(product.media)

    for (const platform of product.platforms ?? []) {
      current.platforms.add(platform)
    }

    for (const tag of tags) {
      current.tags.add(tag)
    }

    for (const tag of sourceTags.filter((item) => item.startsWith('section:'))) {
      current.sourceRanks.set(`${region.region}:${tag}`, {
        region: region.region,
        tag,
        rank,
      })
    }

    current.offers.set(region.region, chooseBetterOffer(current.offers.get(region.region), buildOffer(product, region)))
    target.set(sourceKey, current)
  }

  private async fetchCategorySource(region: RegionConfig, source: SourceConfig) {
    const pageSize = 24
    const maxPages = Number(process.env.PLAYSTATION_MAX_PAGES ?? '0')
    const itemLimit = source.itemLimitByRegion?.[region.region] ?? null
    const concurrency = numberFromEnv('PLAYSTATION_FETCH_CONCURRENCY', 4)
    const batchDelayMs = numberFromEnv('PLAYSTATION_BATCH_DELAY_MS', 250)

    const firstPage = await this.fetchCategoryPage(region, source, 1)
    const totalFromStore = firstPage.pageInfo.totalCount ?? firstPage.products.length
    const effectiveTotal = itemLimit ? Math.min(totalFromStore, itemLimit) : totalFromStore
    const pageCountFromTotal = Math.max(1, Math.ceil(effectiveTotal / (firstPage.pageInfo.size || pageSize)))
    const pageCount = maxPages > 0 ? Math.min(pageCountFromTotal, maxPages) : pageCountFromTotal

    if (pageCount <= 1 || firstPage.isLast) {
      return itemLimit ? firstPage.products.slice(0, itemLimit) : firstPage.products
    }

    const pages = Array.from({ length: pageCount - 1 }, (_, index) => index + 2)
    const restPages = await mapWithConcurrency(
      pages,
      concurrency,
      (page) => this.fetchCategoryPage(region, source, page),
      batchDelayMs,
    )
    const products = [firstPage, ...restPages].flatMap((grid) => grid.products)

    return itemLimit ? products.slice(0, itemLimit) : products
  }

  private async fetchCategoryPage(region: RegionConfig, source: SourceConfig, page: number) {
    const url = `https://store.playstation.com/${region.locale}${source.path}/${page}`
    const attempts = numberFromEnv('PLAYSTATION_FETCH_RETRIES', 3)

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const nextData = await this.fetchNextData(url)
        return this.extractCategoryGrid(nextData, url)
      } catch (error) {
        if (attempt === attempts) {
          throw error
        }

        await sleep(500 * attempt)
      }
    }

    throw new Error(`Unable to fetch PlayStation Store category page: ${url}`)
  }

  private async fetchPageSource(region: RegionConfig, source: SourceConfig) {
    const url = `https://store.playstation.com/${region.locale}${source.path}`
    const nextData = await this.fetchNextData(url)
    return this.extractPageProducts(nextData)
  }

  private async fetchNextData(url: string) {
    if (this.htmlFetcher) {
      const html = await this.htmlFetcher(url)
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
      if (!match) {
        throw new Error(`Unable to locate __NEXT_DATA__ on ${url}`)
      }

      return JSON.parse(match[1]) as NextData
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(45_000),
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        priority: 'u=0, i',
        'sec-ch-ua': '"Chromium";v="147", "Not=A?Brand";v="24", "Google Chrome";v="147"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
    })

    if (!response.ok) {
      throw new Error(`PlayStation Store request failed: ${response.status} ${response.statusText} for ${url}`)
    }

    const html = await response.text()
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!match) {
      throw new Error(`Unable to locate __NEXT_DATA__ on ${url}`)
    }

    return JSON.parse(match[1]) as NextData
  }

  private extractCategoryGrid(nextData: NextData, url: string): CategoryGridResult {
    const apolloState = asObject(nextData.props?.apolloState)
    const rootQuery = asObject(apolloState.ROOT_QUERY)
    const gridKey = Object.keys(rootQuery).find((key) => key.startsWith('categoryGridRetrieve('))
    if (!gridKey) {
      throw new Error(`PlayStation Store category page did not expose categoryGridRetrieve data: ${url}`)
    }

    const gridRef = asObject(rootQuery[gridKey]).__ref
    const grid = asObject(apolloState[String(gridRef)])
    const pageInfo = asObject(grid.pageInfo)
    const productRefs = Array.isArray(grid.products) ? grid.products : []
    const products = productRefs
      .map((entry) => asObject(entry).__ref)
      .map((ref) => asObject(apolloState[String(ref)]))
      .filter((entry) => entry.id && entry.name)
      .map((entry) => entry as unknown as CategoryGridProduct)
    const concepts = asArray(grid.concepts)
      .map((entry) => asObject(entry).__ref)
      .map((ref) => asObject(apolloState[String(ref)]))
      .filter((entry) => entry.id && entry.name)
      .map((entry) => this.mapConceptToCategoryProduct(entry as unknown as ConceptGridEntry))
      .filter((entry): entry is CategoryGridProduct => Boolean(entry))

    return {
      products: products.length > 0 ? products : concepts,
      isLast: Boolean(pageInfo.isLast),
      pageInfo: {
        totalCount: pageInfo.totalCount === undefined ? null : Number(pageInfo.totalCount),
        size: pageInfo.size === undefined ? 24 : Number(pageInfo.size),
      },
    }
  }

  private extractPageProducts(nextData: NextData) {
    const apolloState = asObject(nextData.props?.apolloState)

    return Object.entries(apolloState)
      .filter(([key, value]) => key.startsWith('Product:') && asObject(value).id && asObject(value).name)
      .map(([, value]) => value as CategoryGridProduct)
  }

  private mapConceptToCategoryProduct(concept: ConceptGridEntry): CategoryGridProduct | null {
    const firstProductId = concept.products
      ?.map((entry) => parseProductRefId(entry.__ref))
      .find(Boolean)

    if (!firstProductId) {
      return null
    }

    return {
      id: firstProductId,
      name: concept.name,
      price: concept.price,
      media: concept.media,
      platforms: [],
      storeDisplayClassification: undefined,
    }
  }
}
