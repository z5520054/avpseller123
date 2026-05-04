import { useEffect, useMemo, useState } from 'react'
import { getCatalogProduct } from '../lib/catalog-api'
import type { CatalogApiProduct, EntityId } from '../types'

export function useCatalogProductsByIds(ids: EntityId[]) {
  const numericIds = useMemo(
    () =>
      [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))].sort((left, right) => left - right),
    [ids],
  )
  const requestKey = numericIds.join(',')
  const [state, setState] = useState<{
    key: string | null
    products: CatalogApiProduct[]
    error: string | null
  }>({
    key: null,
    products: [],
    error: null,
  })

  useEffect(() => {
    if (numericIds.length === 0) {
      return
    }

    let active = true

    Promise.all(numericIds.map((id) => getCatalogProduct(id).catch(() => null)))
      .then((products) => {
        if (!active) {
          return
        }

        setState({
          key: requestKey,
          products: products.filter((item): item is CatalogApiProduct => Boolean(item)),
          error: null,
        })
      })
      .catch(() => {
        if (!active) {
          return
        }

        setState({
          key: requestKey,
          products: [],
          error: 'catalog-products-error',
        })
      })

    return () => {
      active = false
    }
  }, [numericIds, requestKey])

  return {
    products: numericIds.length === 0 ? [] : state.key === requestKey ? state.products : [],
    loading: numericIds.length === 0 ? false : state.key !== requestKey,
    error: numericIds.length === 0 ? null : state.key === requestKey ? state.error : null,
  }
}
