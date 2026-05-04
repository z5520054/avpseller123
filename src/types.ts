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
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled'
  acceptedOffer: boolean
  comment: string | null
  cartSnapshot: CartRecalculationResponse
  createdAt: string
  updatedAt: string
}
