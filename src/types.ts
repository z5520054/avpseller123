export type Region = 'Turkey' | 'India'

export type Category =
  | 'Бестселлеры'
  | 'Подписки'
  | 'Новинки'
  | 'Предзаказы'
  | 'Донат'
  | 'Экшен'
  | 'Гонки'
  | 'Хоррор'
  | 'Открытый мир'
  | 'Souls-like'
  | 'Шутеры'
  | 'Семейные'

export type ProductKind = 'game' | 'subscription' | 'currency' | 'bundle' | 'preorder'

export type EntityId = string | number

export interface Product {
  id: EntityId
  title: string
  subtitle: string
  category: Category
  kind: ProductKind
  price: number
  oldPrice?: number
  discount?: number
  region: Region[]
  image: string
  accent: string
  tags: string[]
  features: string[]
  releaseLabel?: string
  gallery: string[]
}

export interface CartItem {
  productId: EntityId
  quantity: number
}

export interface CatalogApiOffer {
  region: string
  currency: string
  basePriceMinor: number | null
  discountedPriceMinor: number | null
  discountPercent: number | null
  saleStartAt: string | null
  saleEndAt: string | null
  plusTier: string | null
  saleName: string | null
  availability: string
  sourceUpdatedAt: string | null
  priceSourceMinor: number | null
  originalPriceSourceMinor: number | null
  priceTryMinor: number | null
  originalPriceTryMinor: number | null
  priceRubMinor: number | null
  originalPriceRubMinor: number | null
  rubRate: number | null
}

export interface CatalogApiProduct {
  id: EntityId
  source: string
  sourceKey: string
  slug: string
  title: string
  kind: 'game' | 'bundle' | 'add-on' | 'edition' | 'currency' | 'subscription'
  storeType: 'game' | 'subscription' | 'preorder'
  productUrl: string
  coverUrl: string | null
  releaseDate: string | null
  publisher: string | null
  developer: string | null
  status: 'active' | 'unavailable' | 'delisted'
  hasRussianLanguage: boolean | null
  russianLanguageSupport: 'none' | 'subtitles' | 'full' | 'unknown'
  platforms: string[]
  tags: string[]
  offers: CatalogApiOffer[]
  bestOffer: CatalogApiOffer | null
}

export interface CatalogApiProductDetail {
  productId: number
  locale: string
  releaseDate: string | null
  editionName: string | null
  publisherName: string | null
  topCategory: string | null
  privacyPolicy: string | null
  contentRating: string | null
  heroBackgroundUrl: string | null
  logoUrl: string | null
  masterImageUrl: string | null
  longDescription: string | null
  compatibilityNotice: string | null
  legalText: string | null
  genres: string[]
  spokenLanguages: string[]
  screenLanguages: string[]
  compatibility: Record<string, Array<{ type: string; value: string }>>
  rating: {
    averageRating: number | null
    totalRatingsCount: number | null
    distribution: Array<{ rating: number; percentage: number }>
  }
  media: Array<{ role: string | null; type: string | null; url: string }>
  editions: Array<{
    productId?: number | null
    sourceKey: string
    title: string
    editionName: string | null
    features: string[]
    coverUrl: string | null
    longDescription?: string | null
    compatibilityNotice?: string | null
    legalText?: string | null
    price: {
      currency: string | null
      basePriceMinor: number | null
      discountedPriceMinor: number | null
      discountPercent: number | null
    }
  }>
  addOns: Array<{
    sourceKey: string
    title: string
    kind: 'game' | 'bundle' | 'add-on' | 'edition' | 'currency' | 'subscription'
    coverUrl: string | null
    price: {
      currency: string | null
      basePriceMinor: number | null
      discountedPriceMinor: number | null
      discountPercent: number | null
    }
  }>
  saleEndAt: string | null
  lowestRecentPrice: string | null
  sourceUpdatedAt: string
  hasRussianLanguage: boolean | null
  russianLanguageSupport: 'none' | 'subtitles' | 'full' | 'unknown'
}

export type PsPlusTier = 'Essential' | 'Extra' | 'Deluxe'
export type PsPlusDuration = 1 | 3 | 12

export interface PsPlusPrice {
  region: string
  tier: PsPlusTier
  durationMonths: PsPlusDuration
  priceRubMinor: number | null
  isActive: boolean
  updatedAt: string
}

export interface HomeBanner {
  id: number
  title: string
  imageUrl: string
  imagePositionX: number
  imagePositionY: number
  imageScale: number
  linkUrl: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface HomeBannerSettings {
  autoplayMs: number
  animation: 'slide' | 'fade' | 'lift'
  updatedAt: string
}

export interface CartSourceLine {
  productId: EntityId
  quantity: number
  product: CatalogApiProduct
  offer: CatalogApiOffer | null
  unitPriceTryMinor: number | null
  unitPriceRubMinor: number | null
  linePriceTryMinor: number | null
  linePriceRubMinor: number | null
}

export interface CartAutoCodeLine {
  code: string
  title: string
  nominalTry: number
  nominalTryMinor: number
  priceRubMinor: number
}

export interface CartPricing {
  sourceTotalTryMinor: number | null
  sourceTotalRubMinor: number
  topUpTotalTryMinor: number | null
  topUpTotalRubMinor: number | null
  payableRubMinor: number
  theoreticalRemainderTryMinor: number | null
  rubRate: number | null
}

export interface CartRecalculationResponse {
  supported: boolean
  region: string
  sourceItems: CartSourceLine[]
  autoCodeItems: CartAutoCodeLine[]
  pricing: CartPricing
  message: string | null
}

export interface OrderRecord {
  id: number
  email: string
  region: string
  status: 'pending' | 'paid' | 'code_sent' | 'fulfilled' | 'cancelled' | 'expired' | 'refunded'
  acceptedOffer: boolean
  comment: string | null
  paymentProvider: string | null
  paymentId: string | null
  paymentStatus: string | null
  paymentConfirmationUrl: string | null
  fulfillmentMode: 'manual' | 'automatic'
  paidAt: string | null
  issuedAt: string | null
  cartSnapshot: CartRecalculationResponse
  createdAt: string
  updatedAt: string
}

export interface AdminFulfillmentDashboard {
  mode: 'manual' | 'automatic'
  ordersToday: number
  waitingOrders: number
  denominations: AdminTopUpDenomination[]
}

export interface AdminTopUpDenomination {
  nominal_try: number
  price_rub_minor: number
  is_active: number
  active_count: number
  sold_count: number
}

export interface AdminTopUpCode {
  id: number
  nominalTry: number
  code: string
  status: string
  orderId: number | null
  addedAt: string
  soldAt: string | null
}

export type AdminParseType = 'price' | 'editions' | 'images'
export type AdminParseRegion = 'turkey' | 'india' | 'all'
export type AdminProxyStatus = 'active' | 'disabled' | 'banned'

export interface AdminProxy {
  id: number
  name: string
  type: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username: string
  password: string
  region: 'turkey' | 'india'
  status: AdminProxyStatus
  last_checked: string | null
  last_response_time_ms: number | null
  last_http_code: number | null
  error_count: number
  created_at: string
  updated_at: string
}

export interface AdminParseTask {
  id: number
  type: AdminParseType
  region: AdminParseRegion
  product_ids: string | null
  proxy_id: number | null
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
  total_items: number
  processed_items: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  error_message: string | null
}

export interface AdminParseProduct {
  id: number
  source_key: string
  title: string
  cover_url: string | null
  last_updated: string | null
  last_status: string | null
  error_count: number
  editions_count: number
  price_minor: number | null
}
