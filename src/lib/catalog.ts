import type { Product, Region } from '../types'

export function matchesRegion(product: Product, region: Region) {
  return product.region.includes(region)
}

export function matchesQuery(product: Product, query: string) {
  if (!query.trim()) {
    return true
  }

  const term = query.toLowerCase()
  return [product.title, product.subtitle, product.category, ...product.tags]
    .join(' ')
    .toLowerCase()
    .includes(term)
}
