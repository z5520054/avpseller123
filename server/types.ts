export type SyncMode = 'full' | 'prices' | 'details'

export type ProductKind = 'game' | 'bundle' | 'add-on' | 'edition' | 'currency' | 'subscription'

export type ProductStatus = 'active' | 'unavailable' | 'delisted'
export type EntityId = string | number

export interface ImportOffer {
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
}

export interface ImportedProduct {
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
  status: ProductStatus
  platforms: string[]
  tags: string[]
  sourceRanks: ProductSourceRank[]
  offers: ImportOffer[]
}

export interface ProductSourceRank {
  region: string
  tag: string
  rank: number
}

export interface ImportedProductDetail {
  sourceKey: string
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
    kind: ProductKind
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
}

export interface ProviderContext {
  mode: SyncMode
  region?: string
}

export interface CatalogProvider {
  name: string
  fetchProducts(context: ProviderContext): Promise<ImportedProduct[]>
  fetchProductDetail?(productId: string, locale: string): Promise<ImportedProductDetail>
}

export interface CatalogListItem {
  id: EntityId
  source: string
  sourceKey: string
  slug: string
  title: string
  kind: ProductKind
  storeType: 'game' | 'subscription' | 'preorder'
  productUrl: string
  coverUrl: string | null
  releaseDate: string | null
  publisher: string | null
  developer: string | null
  status: ProductStatus
  hasRussianLanguage: boolean | null
  russianLanguageSupport: 'none' | 'subtitles' | 'full' | 'unknown'
  platforms: string[]
  tags: string[]
  offers: CatalogCommercialOffer[]
  bestOffer: CatalogCommercialOffer | null
}

export interface CatalogCommercialOffer extends ImportOffer {
  priceSourceMinor: number | null
  originalPriceSourceMinor: number | null
  priceTryMinor: number | null
  originalPriceTryMinor: number | null
  priceRubMinor: number | null
  originalPriceRubMinor: number | null
  rubRate: number | null
}

export interface CatalogProductDetail {
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
    kind: ProductKind
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

export interface CartInputItem {
  productId: EntityId
  quantity: number
}

export interface CartProductLine {
  productId: EntityId
  quantity: number
  product: CatalogListItem
  offer: CatalogCommercialOffer | null
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

export interface CartRecalculationResult {
  supported: boolean
  region: string
  sourceItems: CartProductLine[]
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
  cartSnapshot: CartRecalculationResult
  createdAt: string
  updatedAt: string
}
