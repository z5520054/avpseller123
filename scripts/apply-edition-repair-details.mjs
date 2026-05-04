import { createReadStream, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { getDb } from '../server/db.ts'
import { CatalogRepository } from '../server/services/catalog-repository.ts'

const path = process.argv[2] ?? 'data/edition-repair-details.jsonl'
if (!existsSync(path)) {
  throw new Error(`Repair file not found: ${path}`)
}

const db = getDb()
const repository = new CatalogRepository(db)
const reader = createInterface({
  input: createReadStream(path, { encoding: 'utf8' }),
  crlfDelay: Infinity,
})

let applied = 0
let missing = 0
let products = 0
let offers = 0

for await (const line of reader) {
  if (!line.trim()) continue
  const detail = JSON.parse(line)
  const row = db.prepare('SELECT id FROM products WHERE source_key = ?').get(detail.sourceKey)
  if (!row) {
    missing += 1
    continue
  }

  repository.upsertProductDetail(Number(row.id), detail)
  const stats = repository.upsertEditionProductsFromDetail(Number(row.id), detail)
  applied += 1
  products += stats.products
  offers += stats.offers

  if (applied % 100 === 0) {
    console.log(`applied ${applied}`)
  }
}

console.log(JSON.stringify({ applied, missing, products, offers }))
