import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { PlayStationStoreProvider } from '../server/providers/playstation-store.provider.ts'

const input = JSON.parse(readFileSync('data/edition-repair-sourcekeys.json', 'utf8'))
const checkpointPath = 'data/edition-repair-details.jsonl'
const failedPath = 'data/edition-repair-failed.json'
const sourceKeys = input.sourceKeys
const provider = new PlayStationStoreProvider()

const done = new Set()
if (existsSync(checkpointPath)) {
  for (const line of readFileSync(checkpointPath, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      done.add(JSON.parse(line).sourceKey)
    } catch {
      // Ignore a partial trailing line from an interrupted run.
    }
  }
}

const pending = sourceKeys.filter((sourceKey) => !done.has(sourceKey))
const failed = []
let completed = done.size
let cursor = 0
const concurrency = Number(process.env.REPAIR_CONCURRENCY ?? 4)

async function worker() {
  while (cursor < pending.length) {
    const sourceKey = pending[cursor]
    cursor += 1

    try {
      const detail = await provider.fetchProductDetail(sourceKey, 'en-tr')
      appendFileSync(checkpointPath, `${JSON.stringify(detail)}\n`)
      completed += 1
      if (completed % 25 === 0 || completed === sourceKeys.length) {
        console.log(`details ${completed}/${sourceKeys.length}`)
      }
    } catch (error) {
      failed.push({
        sourceKey,
        message: error instanceof Error ? error.message : String(error),
      })
      console.log(`failed ${sourceKey}: ${failed[failed.length - 1].message}`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

writeFileSync(failedPath, JSON.stringify(failed, null, 2))
console.log(`finished: ok=${completed}, failed=${failed.length}`)
