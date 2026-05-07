import type { OrderRecord } from '../types'

const ORDER_HISTORY_KEY = 'avp-order-history-ids'

export function readOrderHistoryIds() {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(ORDER_HISTORY_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item))
      : []
  } catch {
    return []
  }
}

export function rememberOrder(order: Pick<OrderRecord, 'id'> | number) {
  if (typeof window === 'undefined') {
    return
  }

  const orderId = typeof order === 'number' ? order : order.id
  const ids = readOrderHistoryIds().filter((id) => id !== orderId)
  window.localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([orderId, ...ids].slice(0, 50)))
}
