import { randomUUID } from 'node:crypto'
import { config } from '../config'
import { CatalogRepository } from './catalog-repository'
import { FulfillmentService } from './fulfillment'
import type { OrderRecord } from '../types'

interface YooKassaPayment {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  paid?: boolean
  confirmation?: {
    type?: string
    confirmation_url?: string
  }
}

function authHeader() {
  return `Basic ${Buffer.from(`${config.yookassaShopId}:${config.yookassaSecretKey}`).toString('base64')}`
}

function ensureConfigured() {
  if (!config.yookassaShopId || !config.yookassaSecretKey) {
    throw new Error('YooKassa is not configured')
  }
}

export class YooKassaService {
  constructor(
    private readonly repository = new CatalogRepository(),
    private readonly fulfillment = new FulfillmentService(),
  ) {}

  async createSbpPayment(order: OrderRecord) {
    ensureConfigured()

    const amountRub = (order.cartSnapshot.pricing.payableRubMinor / 100).toFixed(2)
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        'Idempotence-Key': randomUUID(),
      },
      body: JSON.stringify({
        amount: {
          value: amountRub,
          currency: 'RUB',
        },
        capture: true,
        payment_method_data: {
          type: 'sbp',
        },
        confirmation: {
          type: 'redirect',
          return_url: `${config.publicSiteUrl}/orders/${order.id}`,
        },
        description: `AVP Seller заказ #${order.id}`,
        metadata: {
          orderId: String(order.id),
        },
      }),
    })

    const payload = await response.json().catch(() => null) as YooKassaPayment | { description?: string } | null
    if (!response.ok || !payload || !('id' in payload)) {
      const description = payload && 'description' in payload ? payload.description : null
      throw new Error(description || `YooKassa payment failed: ${response.status}`)
    }

    const payment = payload as YooKassaPayment
    this.repository.attachPayment(order.id, {
      provider: 'yookassa',
      paymentId: payment.id,
      paymentStatus: payment.status,
      confirmationUrl: payment.confirmation?.confirmation_url ?? null,
      fulfillmentMode: this.fulfillment.getMode(),
    })

    return this.repository.getOrder(order.id)
  }

  async fetchPayment(paymentId: string) {
    ensureConfigured()

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: {
        Authorization: authHeader(),
      },
    })

    if (!response.ok) {
      throw new Error(`Unable to verify YooKassa payment: ${response.status}`)
    }

    return (await response.json()) as YooKassaPayment
  }

  async handleWebhook(payload: unknown) {
    const event = payload && typeof payload === 'object' && 'event' in payload ? String((payload as { event?: unknown }).event) : ''
    const object = payload && typeof payload === 'object' && 'object' in payload ? (payload as { object?: unknown }).object : null
    const paymentId = object && typeof object === 'object' && 'id' in object ? String((object as { id?: unknown }).id) : ''

    if (!paymentId) {
      throw new Error('YooKassa webhook payment id is missing')
    }

    const verifiedPayment = await this.fetchPayment(paymentId)
    const order = this.repository.getOrderByPaymentId(paymentId)
    if (!order) {
      throw new Error(`Order for payment ${paymentId} not found`)
    }

    this.repository.updatePaymentStatus(order.id, verifiedPayment.status)

    if (event === 'payment.succeeded' && verifiedPayment.status === 'succeeded') {
      const paidOrder = this.repository.markOrderPaid(order.id)
      if (paidOrder?.fulfillmentMode === 'automatic') {
        this.fulfillment.assignAutomaticCodes(order.id)
      }
    }

    if (event === 'payment.canceled' || verifiedPayment.status === 'canceled') {
      this.repository.markOrderCancelled(order.id)
    }

    return { ok: true }
  }
}
