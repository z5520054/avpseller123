import type {
  CatalogApiProduct,
  CatalogApiProductDetail,
  CartItem,
  CartRecalculationResponse,
  OrderRecord,
  HomeBanner,
  HomeBannerSettings,
  PsPlusPrice,
  AdminParseProduct,
  AdminParseRegion,
  AdminParseTask,
  AdminParseType,
  AdminProxy,
  AdminFulfillmentDashboard,
  AdminTopUpCode,
  AdminTopUpDenomination,
} from '../types'

const API_BASE = import.meta.env.VITE_CATALOG_API_BASE?.replace(/\/$/, '') ?? ''

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string }
      message = parsed.message || parsed.error || text
    } catch {
      // Keep raw text when the API does not return JSON.
    }
    throw new Error(message ? `API request failed: ${response.status}. ${message}` : `API request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export function getCatalogProduct(productId: number) {
  return fetchJson<CatalogApiProduct>(`/api/catalog/${productId}`)
}

export function getCatalogProductDetail(productId: number) {
  return fetchJson<CatalogApiProductDetail>(`/api/catalog/${productId}/details`)
}

export function getCatalogList(params: {
  query?: string
  region?: string
  platform?: string
  language?: 'ru_subtitles' | 'ru_full'
  genre?: string
  kind?: string
  tag?: string
  excludeTag?: string | string[]
  discountedOnly?: boolean
  limit?: number
  offset?: number
  sort?: 'updated' | 'price_asc' | 'price_desc' | 'discount' | 'sony' | 'release_desc' | 'release_asc'
}) {
  const search = new URLSearchParams()
  if (params.query) search.set('query', params.query)
  if (params.region) search.set('region', params.region)
  if (params.platform) search.set('platform', params.platform)
  if (params.language) search.set('language', params.language)
  if (params.genre) search.set('genre', params.genre)
  if (params.kind) search.set('kind', params.kind)
  if (params.tag) search.set('tag', params.tag)
  if (params.discountedOnly) search.set('discountedOnly', 'true')
  if (params.excludeTag) {
    const excludeTags = Array.isArray(params.excludeTag) ? params.excludeTag : [params.excludeTag]
    for (const tag of excludeTags) {
      search.append('excludeTag', tag)
    }
  }
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  if (params.sort) search.set('sort', params.sort)

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return fetchJson<{ items: CatalogApiProduct[]; total: number }>(`/api/catalog${suffix}`)
}

export function getCatalogFilters() {
  return fetchJson<{
    regions: string[]
    platforms: string[]
    tags: string[]
    genres: string[]
  }>('/api/catalog/filters')
}

export function getPsPlusPrices(region: 'turkey' | 'india') {
  return fetchJson<{ region: string; items: PsPlusPrice[] }>(`/api/subscriptions/ps-plus?region=${region}`)
}

export function getHomeBanners() {
  return fetchJson<{ items: HomeBanner[]; settings: HomeBannerSettings }>('/api/banners')
}

export function getAdminPsPlusPrices(region: 'turkey' | 'india', token: string) {
  return fetchJson<{ region: string; items: PsPlusPrice[] }>(`/api/admin/ps-plus-prices?region=${region}`, {
    headers: {
      'x-admin-token': token,
    },
  })
}

export function updateAdminPsPlusPrices(
  token: string,
  input: {
    region: 'turkey' | 'india'
    items: Array<Pick<PsPlusPrice, 'tier' | 'durationMonths' | 'priceRubMinor' | 'isActive'>>
  },
) {
  return fetchJson<{ region: string; items: PsPlusPrice[] }>('/api/admin/ps-plus-prices', {
    method: 'PUT',
    headers: {
      'x-admin-token': token,
    },
    body: JSON.stringify(input),
  })
}

export function getAdminBanners(token: string) {
  return fetchJson<{ items: HomeBanner[]; settings: HomeBannerSettings }>('/api/admin/banners', {
    headers: {
      'x-admin-token': token,
    },
  })
}

export function updateAdminBanners(
  token: string,
  input: {
    items: Array<{
      id?: number
      title: string
      imageUrl?: string | null
      imageDataUrl?: string | null
      imagePositionX?: number
      imagePositionY?: number
      imageScale?: number
      linkUrl: string
      sortOrder: number
      isActive: boolean
    }>
    settings?: Pick<HomeBannerSettings, 'autoplayMs' | 'animation'>
  },
) {
  return fetchJson<{ items: HomeBanner[]; settings: HomeBannerSettings }>('/api/admin/banners', {
    method: 'PUT',
    headers: {
      'x-admin-token': token,
    },
    body: JSON.stringify(input),
  })
}

export function refreshAdminProduct(
  token: string,
  input: {
    productId?: number
    sourceKey?: string
    locale?: 'en-tr' | 'en-in'
  },
) {
  return fetchJson<{
    productId: number
    sourceKey: string
    locale: string
    editions: number
    editionProducts: number
    editionOffers: number
  }>('/api/admin/products/refresh', {
    method: 'POST',
    headers: {
      'x-admin-token': token,
    },
    body: JSON.stringify(input),
  })
}

export function getAdminProxies(token: string) {
  return fetchJson<{ items: AdminProxy[] }>('/api/admin/proxy', {
    headers: { 'x-admin-token': token },
  })
}

export function createAdminProxy(
  token: string,
  input: {
    name: string
    type: 'http' | 'https' | 'socks5'
    host: string
    port: number
    username?: string
    password?: string
    region: 'turkey' | 'india'
    testBeforeSave?: boolean
  },
) {
  return fetchJson<{ item: AdminProxy }>('/api/admin/proxy', {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: JSON.stringify(input),
  })
}

export function deleteAdminProxy(token: string, id: number) {
  return fetchJson<{ success: boolean }>(`/api/admin/proxy/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': token },
  })
}

export function toggleAdminProxy(token: string, id: number) {
  return fetchJson<{ item: AdminProxy }>(`/api/admin/proxy/${id}/toggle`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
  })
}

export function testAdminProxy(token: string, id: number) {
  return fetchJson<{
    success: boolean
    status: string
    responseTimeMs: number
    httpCode: number | null
    errorMessage: string | null
    message: string
  }>(`/api/admin/proxy/${id}/test`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
  })
}

export function getAdminParseProducts(
  token: string,
  params: { region?: AdminParseRegion; query?: string; limit?: number; offset?: number },
) {
  const search = new URLSearchParams()
  if (params.region) search.set('region', params.region)
  if (params.query) search.set('query', params.query)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  return fetchJson<{ items: AdminParseProduct[]; total: number }>(`/api/admin/parse/products?${search.toString()}`, {
    headers: { 'x-admin-token': token },
  })
}

export function getAdminParseTasks(token: string) {
  return fetchJson<{ tasks: AdminParseTask[] }>('/api/admin/parse/tasks', {
    headers: { 'x-admin-token': token },
  })
}

export function createAdminParseTask(
  token: string,
  type: AdminParseType,
  input: {
    region: AdminParseRegion
    productIds?: Array<number | string> | null
    proxyId?: number | null
  },
) {
  return fetchJson<{ taskId: number; status: string; totalItems: number }>(`/api/admin/parse/${type}`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: JSON.stringify(input),
  })
}

export function resumeAdminParseTask(token: string, taskId: number) {
  return fetchJson<{
    taskId: number
    status: string
    totalItems: number
    resumedFromTaskId: number
    skippedItems: number
    remainingItems: number
  }>(`/api/admin/parse/task/${taskId}/resume`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
  })
}

export function recalculateCart(region: 'turkey' | 'india', items: CartItem[]) {
  return fetchJson<CartRecalculationResponse>('/api/cart/recalculate', {
    method: 'POST',
    body: JSON.stringify({
      region,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }),
  })
}

export function createOrder(input: {
  email: string
  region: 'turkey' | 'india'
  acceptedOffer: true
  comment?: string
  items: CartItem[]
}) {
  return fetchJson<OrderRecord>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }),
  })
}

export function getAdminFulfillmentDashboard(token: string) {
  return fetchJson<AdminFulfillmentDashboard>('/api/admin/fulfillment/dashboard', {
    headers: { 'x-admin-token': token },
  })
}

export function updateAdminFulfillmentMode(token: string, mode: 'manual' | 'automatic') {
  return fetchJson<{ mode: 'manual' | 'automatic' }>('/api/admin/fulfillment/mode', {
    method: 'PUT',
    headers: { 'x-admin-token': token },
    body: JSON.stringify({ mode }),
  })
}

export function updateAdminDenomination(
  token: string,
  input: { nominalTry: number; priceRubMinor: number; isActive: boolean },
) {
  return fetchJson<{ items: AdminTopUpDenomination[] }>('/api/admin/fulfillment/denomination', {
    method: 'PUT',
    headers: { 'x-admin-token': token },
    body: JSON.stringify(input),
  })
}

export function getAdminTopUpCodes(
  token: string,
  params: { nominalTry?: number; status?: string; reveal?: boolean } = {},
) {
  const search = new URLSearchParams()
  if (params.nominalTry) search.set('nominalTry', String(params.nominalTry))
  if (params.status) search.set('status', params.status)
  if (params.reveal) search.set('reveal', 'true')
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return fetchJson<{ items: AdminTopUpCode[] }>(`/api/admin/fulfillment/codes${suffix}`, {
    headers: { 'x-admin-token': token },
  })
}

export function addAdminTopUpCodes(token: string, input: { nominalTry: number; codes: string }) {
  return fetchJson<{ added: number; codes: AdminTopUpCode[] }>('/api/admin/fulfillment/codes', {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: JSON.stringify(input),
  })
}

export function getAdminFulfillmentOrders(token: string, params: { status?: string; query?: string } = {}) {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.query) search.set('query', params.query)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return fetchJson<{ items: unknown[] }>(`/api/admin/fulfillment/orders${suffix}`, {
    headers: { 'x-admin-token': token },
  })
}

export function getOrder(orderId: number) {
  return fetchJson<OrderRecord>(`/api/orders/${orderId}`)
}
