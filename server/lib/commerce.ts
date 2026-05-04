import { config } from '../config'
import type {
  CartAutoCodeLine,
  CartInputItem,
  CartProductLine,
  CartPricing,
  CartRecalculationResult,
  CatalogCommercialOffer,
  CatalogListItem,
  ImportOffer,
} from '../types'

export const TURKEY_REGION = 'turkey'
const RUB_ROUNDING_STEP_MINOR = 5 * 100

function currentSourcePriceMinor(offer: ImportOffer | CatalogCommercialOffer) {
  return offer.discountedPriceMinor ?? offer.basePriceMinor ?? null
}

export function roundRubMinorUpToNearestFive(value: number | null) {
  if (value === null) {
    return null
  }

  return Math.ceil(value / RUB_ROUNDING_STEP_MINOR) * RUB_ROUNDING_STEP_MINOR
}

function convertTryMinorToRubMinor(value: number | null) {
  return value === null ? null : roundRubMinorUpToNearestFive(value * config.turkeyRubRate)
}

export function toCommercialOffer(offer: ImportOffer): CatalogCommercialOffer {
  const priceSourceMinor = currentSourcePriceMinor(offer)
  const originalSourceMinor = offer.basePriceMinor
  const isTurkey = offer.region === TURKEY_REGION && offer.currency === 'TRY'
  const isRub = offer.currency === 'RUB'
  const priceTryMinor = isTurkey ? priceSourceMinor : null
  const originalPriceTryMinor = isTurkey ? originalSourceMinor : null
  const priceRubMinor = isRub ? priceSourceMinor : convertTryMinorToRubMinor(priceTryMinor)
  const originalPriceRubMinor = isRub ? originalSourceMinor : convertTryMinorToRubMinor(originalPriceTryMinor)

  return {
    ...offer,
    priceSourceMinor,
    originalPriceSourceMinor: originalSourceMinor,
    priceTryMinor,
    originalPriceTryMinor,
    priceRubMinor,
    originalPriceRubMinor,
    rubRate: isTurkey ? config.turkeyRubRate : null,
  }
}

export function pickOfferForRegion(product: CatalogListItem, region: string) {
  return (
    product.offers.find((offer) => offer.region === region) ??
    product.bestOffer ??
    product.offers[0] ??
    null
  )
}

export function deriveStoreType(kind: CatalogListItem['kind'], tags: string[]) {
  if (tags.includes('section:preorders')) {
    return 'preorder' as const
  }
  if (kind === 'subscription') {
    return 'subscription' as const
  }
  return 'game' as const
}

function pickCodeNominal(remainingTryMinor: number) {
  const code = config.turkeyTopUpCodeNominals.find((nominal) => nominal * 100 >= remainingTryMinor)
  return code ?? config.turkeyTopUpCodeNominals[config.turkeyTopUpCodeNominals.length - 1]
}

export function recalculateTurkeyCart(options: {
  items: CartInputItem[]
  products: CatalogListItem[]
  region: string
}): CartRecalculationResult {
  const { items, products, region } = options

  const indexedProducts = new Map(products.map((product) => [product.id, product]))
  const sourceItems = items
    .map<CartProductLine | null>((item) => {
      const product = indexedProducts.get(item.productId)
      if (!product) {
        return null
      }

      const offer = pickOfferForRegion(product, region)
      return {
        productId: product.id,
        quantity: item.quantity,
        product,
        offer,
        unitPriceTryMinor: offer?.priceTryMinor ?? null,
        unitPriceRubMinor: offer?.priceRubMinor ?? null,
        linePriceTryMinor: offer?.priceTryMinor == null ? null : offer.priceTryMinor * item.quantity,
        linePriceRubMinor: offer?.priceRubMinor == null ? null : offer.priceRubMinor * item.quantity,
      }
    })
    .filter((item): item is CartProductLine => item !== null)

  const sourceTotalTryMinor = sourceItems.reduce((sum, item) => sum + (item.linePriceTryMinor ?? 0), 0)
  const sourceTotalRubMinor = sourceItems.reduce((sum, item) => sum + (item.linePriceRubMinor ?? 0), 0)
  const directRubTotalMinor = sourceItems.reduce(
    (sum, item) => sum + (item.linePriceTryMinor === null ? item.linePriceRubMinor ?? 0 : 0),
    0,
  )

  if (region !== TURKEY_REGION) {
    const pricing: CartPricing = {
      sourceTotalTryMinor: null,
      sourceTotalRubMinor,
      topUpTotalTryMinor: null,
      topUpTotalRubMinor: null,
      payableRubMinor: sourceTotalRubMinor,
      theoreticalRemainderTryMinor: null,
      rubRate: null,
    }

    return {
      supported: false,
      region,
      sourceItems,
      autoCodeItems: [],
      pricing,
      message: 'Автоподбор кодов пополнения сейчас реализован только для Турции.',
    }
  }

  const autoCodeItems: CartAutoCodeLine[] = []
  let remaining = sourceTotalTryMinor

  if (remaining > 0) {
    if (remaining <= 5000 * 100) {
      const nominal = pickCodeNominal(remaining)
      autoCodeItems.push(createTurkeyCodeLine(nominal, 1))
    } else {
      const maxNominalMinor = 5000 * 100
      const fullCodes = Math.floor(remaining / maxNominalMinor)
      for (let index = 0; index < fullCodes; index += 1) {
        autoCodeItems.push(createTurkeyCodeLine(5000, index + 1))
      }

      remaining = remaining % maxNominalMinor
      if (remaining > 0) {
        const nominal = pickCodeNominal(remaining)
        autoCodeItems.push(createTurkeyCodeLine(nominal, fullCodes + 1))
      }
    }
  }

  const topUpTotalTryMinor = autoCodeItems.reduce((sum, item) => sum + item.nominalTryMinor, 0)
  const topUpTotalRubMinor = autoCodeItems.reduce((sum, item) => sum + item.priceRubMinor, 0)

  const pricing: CartPricing = {
    sourceTotalTryMinor,
    sourceTotalRubMinor,
    topUpTotalTryMinor,
    topUpTotalRubMinor,
    payableRubMinor: topUpTotalRubMinor + directRubTotalMinor,
    theoreticalRemainderTryMinor: topUpTotalTryMinor - sourceTotalTryMinor,
    rubRate: config.turkeyRubRate,
  }

  return {
    supported: true,
    region,
    sourceItems,
    autoCodeItems,
    pricing,
    message:
      pricing.theoreticalRemainderTryMinor && pricing.theoreticalRemainderTryMinor > 0
        ? 'Остаток после активации кодов сохранится на вашем турецком аккаунте PlayStation.'
        : null,
  }
}

function createTurkeyCodeLine(nominalTry: number, index: number): CartAutoCodeLine {
  const nominalTryMinor = nominalTry * 100
  return {
    code: `wallet-topup-${nominalTry}-${index}`,
    title: `Код пополнения PS Store Turkey ${nominalTry} TRY`,
    nominalTry,
    nominalTryMinor,
    priceRubMinor: convertTryMinorToRubMinor(nominalTryMinor) ?? 0,
  }
}
