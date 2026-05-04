import { createHash } from 'node:crypto'

function hasCyrillic(value: string) {
  return /[а-яё]/i.test(value)
}

export function hashText(value: string) {
  return createHash('sha1').update(value).digest('hex')
}

export async function translateToRussian(value: string) {
  const text = value.trim()
  if (!text || hasCyrillic(text)) {
    return text
  }

  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'auto')
  url.searchParams.set('tl', 'ru')
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Translation request failed: ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return text
  }

  const translated = payload[0]
    .map((part) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
    .join('')
    .trim()

  return translated || text
}
