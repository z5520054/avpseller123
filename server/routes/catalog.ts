import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../config'
import { hashText, translateToRussian } from '../lib/translate'
import { getProvider } from '../providers'
import { CatalogRepository } from '../services/catalog-repository'
import { HomeBannersService } from '../services/home-banners'
import { ManualParseService } from '../services/manual-parse'
import { PsPlusPricesService, psPlusTiers } from '../services/ps-plus-prices'

const listQuerySchema = z.object({
  query: z.string().optional(),
  region: z.string().optional(),
  platform: z.string().optional(),
  language: z.enum(['ru_subtitles', 'ru_full']).optional(),
  genre: z.string().optional(),
  kind: z.string().optional(),
  tag: z.string().optional(),
  excludeTag: z.union([z.string(), z.array(z.string())]).optional(),
  discountedOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['updated', 'price_asc', 'price_desc', 'discount', 'sony', 'release_desc', 'release_asc']).default('updated'),
})

const historyQuerySchema = z.object({
  region: z.string().optional(),
})

const cartProductIdSchema = z.union([
  z.coerce.number().int().positive(),
  z.string().regex(/^psplus:(turkey|india):(Essential|Extra|Deluxe):(1|3|12)$/),
])

const recalculateCartBodySchema = z.object({
  region: z.enum(['turkey', 'india']).default('turkey'),
  items: z.array(z.object({
    productId: cartProductIdSchema,
    quantity: z.coerce.number().int().min(1).max(100),
  })),
})

const createOrderBodySchema = z.object({
  email: z.email(),
  region: z.enum(['turkey', 'india']).default('turkey'),
  acceptedOffer: z.literal(true),
  comment: z.string().trim().max(1000).optional(),
  items: z.array(z.object({
    productId: cartProductIdSchema,
    quantity: z.coerce.number().int().min(1).max(100),
  })).min(1),
})

const productsAliasQuerySchema = z.object({
  region: z.enum(['tr', 'in', 'turkey', 'india']).optional(),
  type: z.enum(['sale', 'preorder', 'subscription', 'popular', 'games']).optional(),
  platform: z.string().optional(),
  language: z.enum(['ru_subtitles', 'ru_full']).optional(),
  genre: z.string().optional(),
  query: z.string().optional(),
  discountedOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['updated', 'price_asc', 'price_desc', 'discount', 'sony', 'release_desc', 'release_asc']).default('updated'),
})

const psPlusQuerySchema = z.object({
  region: z.enum(['turkey', 'india']).default('turkey'),
})

const adminPsPlusBodySchema = z.object({
  region: z.enum(['turkey', 'india']).default('turkey'),
  items: z.array(z.object({
    tier: z.enum(psPlusTiers),
    durationMonths: z.union([z.literal(1), z.literal(3), z.literal(12)]),
    priceRubMinor: z
      .union([z.number().int().min(0), z.string(), z.null()])
      .transform((value, context) => {
        if (value === null) {
          return null
        }

        if (typeof value === 'number') {
          return value
        }

        const normalized = value
          .trim()
          .replace(/\s+/g, '')
          .replace(/[^\d,.]/g, '')
          .replace(',', '.')
        if (!normalized) {
          return null
        }

        const rub = Number(normalized)
        if (!Number.isFinite(rub) || rub < 0) {
          context.addIssue({
            code: 'custom',
            message: 'Invalid RUB price',
          })
          return z.NEVER
        }

        return Math.round(rub * 100)
      }),
    isActive: z.boolean(),
  })),
})

const adminBannersBodySchema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(120),
    imageUrl: z.string().trim().optional().nullable(),
    imageDataUrl: z.string().optional().nullable(),
    imagePositionX: z.number().int().min(0).max(100).default(50),
    imagePositionY: z.number().int().min(0).max(100).default(50),
    imageScale: z.number().min(1).max(2).default(1),
    linkUrl: z.string().trim().min(1).max(500),
    sortOrder: z.number().int().min(0).max(100000),
    isActive: z.boolean(),
  })),
  settings: z.object({
    autoplayMs: z.coerce.number().int().min(500).max(60000),
    animation: z.enum(['slide', 'fade', 'lift']),
  }).optional(),
})

const adminRefreshProductBodySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  sourceKey: z.string().trim().min(1).optional(),
  locale: z.enum(['en-tr', 'en-in']).optional(),
}).refine((value) => value.productId || value.sourceKey, {
  message: 'productId or sourceKey is required',
})

const adminProxyBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['http', 'https', 'socks5']).default('http'),
  host: z.string().trim().min(1).max(200),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().max(200).optional().default(''),
  password: z.string().max(500).optional().default(''),
  region: z.enum(['turkey', 'india', 'tr', 'in']),
  status: z.enum(['active', 'disabled', 'banned']).optional(),
  testBeforeSave: z.boolean().optional().default(false),
})

const adminProxyUpdateBodySchema = adminProxyBodySchema.partial()

const adminParseBodySchema = z.object({
  region: z.enum(['turkey', 'india', 'all', 'tr', 'in']).default('turkey'),
  productIds: z.array(z.union([z.coerce.number().int().positive(), z.string().trim().min(1)])).nullable().optional(),
  product_ids: z.array(z.union([z.coerce.number().int().positive(), z.string().trim().min(1)])).nullable().optional(),
  proxyId: z.coerce.number().int().positive().nullable().optional(),
  proxy_id: z.coerce.number().int().positive().nullable().optional(),
})

const adminParseProductsQuerySchema = z.object({
  region: z.enum(['turkey', 'india', 'all', 'tr', 'in']).optional().default('all'),
  query: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
})

function mapAliasRegion(region?: string) {
  if (!region) {
    return undefined
  }

  return region === 'tr' ? 'turkey' : region === 'in' ? 'india' : region
}

function mapAliasType(type?: 'sale' | 'preorder' | 'subscription' | 'popular' | 'games') {
  const empty: { tag?: string; kind?: string } = {}

  switch (type) {
    case 'sale':
      return { tag: 'section:deals' }
    case 'preorder':
      return { tag: 'section:preorders' }
    case 'subscription':
      return { tag: 'section:subscriptions' }
    case 'popular':
      return { tag: 'section:games' }
    case 'games':
      return { tag: 'section:games' }
    default:
      return empty
  }
}

export async function registerCatalogRoutes(app: FastifyInstance) {
  const repository = new CatalogRepository()
  const psPlusPrices = new PsPlusPricesService()
  const homeBanners = new HomeBannersService()
  const manualParse = new ManualParseService()

  function requireAdminToken(request: { headers: Record<string, unknown> }, reply: { code: (statusCode: number) => unknown }) {
    const token = String(request.headers['x-admin-token'] ?? '')
    const authorization = String(request.headers.authorization ?? '')
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''
    const expected = config.adminToken

    if (!expected || (token !== expected && bearerToken !== expected)) {
      reply.code(401)
      return false
    }

    return true
  }

  app.get('/health', async () => ({
    ok: true,
    service: 'catalog-api',
  }))

  app.get('/api/catalog', async (request) => {
    const query = listQuerySchema.parse(request.query)
    return repository.listCatalog(query)
  })

  app.get('/api/catalog/filters', async () => repository.getCatalogFilters())

  app.get('/api/banners', async () => ({
    items: homeBanners.list({ activeOnly: true }),
    settings: homeBanners.getSettings(),
  }))

  app.get('/api/subscriptions/ps-plus', async (request) => {
    const query = psPlusQuerySchema.parse(request.query)
    return {
      region: query.region,
      items: psPlusPrices.list(query.region).filter((item) => item.isActive),
    }
  })

  app.get('/api/admin/ps-plus-prices', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const query = psPlusQuerySchema.parse(request.query)
    return {
      region: query.region,
      items: psPlusPrices.list(query.region),
    }
  })

  app.put('/api/admin/ps-plus-prices', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const body = adminPsPlusBodySchema.parse(request.body)
    return {
      region: body.region,
      items: psPlusPrices.updateMany(body),
    }
  })

  app.get('/api/admin/banners', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    return { items: homeBanners.list(), settings: homeBanners.getSettings() }
  })

  app.put('/api/admin/banners', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const body = adminBannersBodySchema.parse(request.body)
    const settings = body.settings ? homeBanners.updateSettings(body.settings) : homeBanners.getSettings()
    return { items: homeBanners.replaceMany(body.items), settings }
  })

  app.post('/api/admin/products/refresh', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const body = adminRefreshProductBodySchema.parse(request.body)
    const product = body.productId
      ? repository.getProduct(body.productId)
      : repository.getProductBySourceKey(body.sourceKey ?? '')

    if (!product) {
      reply.code(404)
      return { error: 'Product not found' }
    }

    const provider = getProvider(config.defaultProvider)
    if (!provider.fetchProductDetail) {
      reply.code(400)
      return { error: `Provider ${provider.name} does not support product detail refresh` }
    }

    const locale = body.locale
      ?? (product.offers.some((offer) => offer.region === 'turkey') ? 'en-tr' : 'en-in')
    const productId = Number(product.id)

    try {
      const detail = await provider.fetchProductDetail(product.sourceKey, locale)
      repository.upsertProductDetail(productId, detail)
      const editionStats = repository.upsertEditionProductsFromDetail(productId, detail)

      return {
        productId,
        sourceKey: product.sourceKey,
        locale: detail.locale,
        editions: detail.editions.length,
        editionProducts: editionStats.products,
        editionOffers: editionStats.offers,
        product: repository.getProduct(productId),
        detail: repository.getProductDetail(productId),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.code(message.includes('403 Forbidden') ? 429 : 502)
      return {
        error: 'Product refresh failed',
        message,
      }
    }
  })

  app.get('/api/admin/proxy', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    return { items: manualParse.listProxies() }
  })

  app.post('/api/admin/proxy', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const body = adminProxyBodySchema.parse(request.body)
    try {
      return { item: await manualParse.createProxy(body) }
    } catch (error) {
      reply.code(400)
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  app.put('/api/admin/proxy/:id', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const id = Number((request.params as { id: string }).id)
    const body = adminProxyUpdateBodySchema.parse(request.body)
    const item = manualParse.updateProxy(id, body)
    if (!item) {
      reply.code(404)
      return { error: 'Proxy not found' }
    }
    return { item }
  })

  app.delete('/api/admin/proxy/:id', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const id = Number((request.params as { id: string }).id)
    return manualParse.deleteProxy(id)
  })

  app.post('/api/admin/proxy/:id/test', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const id = Number((request.params as { id: string }).id)
    try {
      return await manualParse.testProxy(id)
    } catch (error) {
      reply.code(404)
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  app.post('/api/admin/proxy/:id/toggle', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const id = Number((request.params as { id: string }).id)
    const item = manualParse.toggleProxy(id)
    if (!item) {
      reply.code(404)
      return { error: 'Proxy not found' }
    }
    return { item }
  })

  app.get('/api/admin/parse/products', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const query = adminParseProductsQuerySchema.parse(request.query)
    return manualParse.listParseProducts(query)
  })

  app.get('/api/admin/parse/tasks', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    return { tasks: manualParse.listTasks(30) }
  })

  app.get('/api/admin/parse/task/:id', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const id = Number((request.params as { id: string }).id)
    const task = manualParse.getTask(id)
    if (!task) {
      reply.code(404)
      return { error: 'Task not found' }
    }
    return { task }
  })

  app.post('/api/admin/parse/task/:id/resume', async (request, reply) => {
    if (!requireAdminToken(request, reply)) {
      return { error: 'Unauthorized' }
    }

    const id = Number((request.params as { id: string }).id)
    try {
      return manualParse.resumeTask(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.code(message === 'Task not found' ? 404 : 400)
      return { error: message }
    }
  })

  for (const type of ['price', 'editions', 'images'] as const) {
    app.post(`/api/admin/parse/${type}`, async (request, reply) => {
      if (!requireAdminToken(request, reply)) {
        return { error: 'Unauthorized' }
      }

      const body = adminParseBodySchema.parse(request.body)
      const normalizedRegion = body.region === 'tr' ? 'turkey' : body.region === 'in' ? 'india' : body.region
      const productIds = body.productIds ?? body.product_ids ?? null
      const proxyId = body.proxyId ?? body.proxy_id ?? null
      return manualParse.createTask({ type, region: normalizedRegion, productIds, proxyId })
    })
  }

  app.get('/api/catalog/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const product = repository.getProduct(id)
    if (!product) {
      reply.code(404)
      return { error: 'Not found' }
    }

    return product
  })

  app.get('/api/catalog/:id/details', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const details = repository.getProductDetail(id)
    if (!details) {
      reply.code(404)
      return { error: 'Not found' }
    }

    if (!details.longDescription) {
      return details
    }

    const sourceHash = hashText(details.longDescription)
    const cached = repository.getProductTranslation(id, 'longDescription', 'ru', sourceHash)
    if (cached) {
      return {
        ...details,
        longDescription: cached,
      }
    }

    try {
      const translated = await translateToRussian(details.longDescription)
      repository.upsertProductTranslation({
        productId: id,
        field: 'longDescription',
        locale: 'ru',
        sourceHash,
        text: translated,
      })

      return {
        ...details,
        longDescription: translated,
      }
    } catch {
      return details
    }
  })

  app.get('/api/catalog/:id/history', async (request) => {
    const id = Number((request.params as { id: string }).id)
    const query = historyQuerySchema.parse(request.query)
    return repository.getPriceHistory(id, query.region)
  })

  app.post('/api/cart/recalculate', async (request) => {
    const body = recalculateCartBodySchema.parse(request.body)
    return repository.recalculateCart(body)
  })

  app.post('/api/orders', async (request) => {
    const body = createOrderBodySchema.parse(request.body)
    return repository.createOrder(body)
  })

  app.get('/api/orders/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const order = repository.getOrder(id)
    if (!order) {
      reply.code(404)
      return { error: 'Not found' }
    }

    return order
  })

  app.get('/api/products', async (request) => {
    const query = productsAliasQuerySchema.parse(request.query)
    const mapped = mapAliasType(query.type)
    return repository.listCatalog({
      query: query.query,
      region: mapAliasRegion(query.region),
      platform: query.platform,
      language: query.language,
      genre: query.genre,
      tag: mapped.tag,
      kind: mapped.kind,
      discountedOnly: query.discountedOnly || query.type === 'sale',
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
    })
  })

  app.get('/api/products/:slug', async (request, reply) => {
    const slug = String((request.params as { slug: string }).slug)
    const product = repository.getProductBySlug(slug)
    if (!product) {
      reply.code(404)
      return { error: 'Not found' }
    }

    const detail = repository.getProductDetail(Number(product.id))
    return {
      ...product,
      detail,
    }
  })

  app.get('/api/sync-runs', async () => repository.getLatestSyncRuns())
}
