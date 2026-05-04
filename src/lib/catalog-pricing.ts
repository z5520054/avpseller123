import { formatMoneyMinor } from './format'
import type { CatalogApiOffer, CatalogApiProduct, Region } from '../types'

export function regionToApi(region: Region) {
  return region === 'Turkey' ? 'turkey' : 'india'
}

export function pickOffer(product: CatalogApiProduct, region: Region) {
  const targetRegion = regionToApi(region)
  return (
    product.offers.find((offer) => offer.region === targetRegion) ??
    product.bestOffer ??
    product.offers[0] ??
    null
  )
}

export function formatDisplayPrice(offer: CatalogApiOffer | null, region: Region) {
  if (!offer) {
    return null
  }

  if (region === 'Turkey' && offer.priceRubMinor !== null) {
    return formatMoneyMinor(offer.priceRubMinor, 'RUB')
  }

  return formatMoneyMinor(offer.discountedPriceMinor ?? offer.basePriceMinor ?? null, offer.currency)
}

export function formatDisplayOriginalPrice(offer: CatalogApiOffer | null, region: Region) {
  if (!offer) {
    return null
  }

  if (region === 'Turkey' && offer.originalPriceRubMinor !== null) {
    return formatMoneyMinor(offer.originalPriceRubMinor, 'RUB')
  }

  return formatMoneyMinor(offer.basePriceMinor ?? null, offer.currency)
}
