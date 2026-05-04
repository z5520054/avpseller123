import type { PsPlusDuration, PsPlusTier, Region } from '../types'

export function makePsPlusProductId(region: Region, tier: PsPlusTier, durationMonths: PsPlusDuration) {
  const apiRegion = region === 'Turkey' ? 'turkey' : 'india'
  return `psplus:${apiRegion}:${tier}:${durationMonths}`
}
