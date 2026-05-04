import { useEffect, useMemo, useState } from 'react'
import { recalculateCart } from '../lib/catalog-api'
import { regionToApi } from '../lib/catalog-pricing'
import { useAppState } from '../store/use-app-state'
import type { CartRecalculationResponse } from '../types'

const emptyResponse: CartRecalculationResponse = {
  supported: true,
  region: 'turkey',
  sourceItems: [],
  autoCodeItems: [],
  pricing: {
    sourceTotalTryMinor: 0,
    sourceTotalRubMinor: 0,
    topUpTotalTryMinor: 0,
    topUpTotalRubMinor: 0,
    payableRubMinor: 0,
    theoreticalRemainderTryMinor: 0,
    rubRate: 3,
  },
  message: null,
}

export function useCartRecalculation() {
  const { cart, region } = useAppState()
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        region,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
    [cart, region],
  )
  const [state, setState] = useState<{
    key: string | null
    result: CartRecalculationResponse
    error: string | null
  }>({
    key: null,
    result: emptyResponse,
    error: null,
  })

  useEffect(() => {
    if (cart.length === 0) {
      return
    }

    let active = true

    recalculateCart(regionToApi(region), cart)
      .then((result) => {
        if (!active) {
          return
        }

        setState({
          key: requestKey,
          result,
          error: null,
        })
      })
      .catch(() => {
        if (!active) {
          return
        }

        setState({
          key: requestKey,
          result: emptyResponse,
          error: 'cart-recalculation-error',
        })
      })

    return () => {
      active = false
    }
  }, [cart, region, requestKey])

  return {
    loading: cart.length > 0 && state.key !== requestKey,
    error: cart.length > 0 && state.key === requestKey ? state.error : null,
    result: cart.length === 0 ? emptyResponse : state.key === requestKey ? state.result : emptyResponse,
  }
}
