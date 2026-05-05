import type {
  CatalogApiProduct,
  CatalogApiProductDetail,
  CartItem,
  CartRecalculationResponse,
  OrderRecord,
  HomeBanner,
  HomeBannerSettings,
  PsPlusPrice,
} from '../types'

const API_BASE = import.meta.env.VITE_CATALOG_API_BASE?.replace(/\/$/, '') ?? ''

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
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

export function getOrder(orderId: number) {
  return fetchJson<OrderRecord>(`/api/orders/${orderId}`)
}
