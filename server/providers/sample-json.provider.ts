import fs from 'node:fs/promises'
import { z } from 'zod'
import { config } from '../config'
import type { CatalogProvider, ImportedProduct, ProviderContext } from '../types'

const importOfferSchema = z.object({
  region: z.string(),
  currency: z.string(),
  basePriceMinor: z.number().int().nullable(),
  discountedPriceMinor: z.number().int().nullable(),
  discountPercent: z.number().int().nullable(),
  saleStartAt: z.string().nullable(),
  saleEndAt: z.string().nullable(),
  plusTier: z.string().nullable(),
  saleName: z.string().nullable(),
  availability: z.string(),
  sourceUpdatedAt: z.string().nullable(),
})

const importedProductSchema = z.object({
  source: z.string(),
  sourceKey: z.string(),
  slug: z.string(),
  title: z.string(),
  kind: z.enum(['game', 'bundle', 'add-on', 'edition', 'currency', 'subscription']),
  productUrl: z.string(),
  coverUrl: z.string().nullable(),
  releaseDate: z.string().nullable(),
  publisher: z.string().nullable(),
  developer: z.string().nullable(),
  status: z.enum(['active', 'unavailable', 'delisted']),
  platforms: z.array(z.string()),
  tags: z.array(z.string()),
  sourceRanks: z.array(z.object({
    region: z.string(),
    tag: z.string(),
    rank: z.number(),
  })).default([]),
  offers: z.array(importOfferSchema),
})

export class SampleJsonProvider implements CatalogProvider {
  name = 'sample-json'

  async fetchProducts(context: ProviderContext): Promise<ImportedProduct[]> {
    void context
    const raw = await fs.readFile(config.sampleImportPath, 'utf8')
    return z.array(importedProductSchema).parse(JSON.parse(raw))
  }
}
