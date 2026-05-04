import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { CartItem, EntityId, Region } from '../types'
import { AppStateContext, type AppStateValue } from './app-state-context'

const STORAGE_KEY = 'mono-luxury-console-boutique'

interface PersistedState {
  region: Region
  cart: CartItem[]
  favorites: EntityId[]
  searchQuery: string
}

const defaultState: PersistedState = {
  region: 'Turkey',
  cart: [],
  favorites: [],
  searchQuery: '',
}

function readState(): PersistedState {
  if (typeof window === 'undefined') {
    return defaultState
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaultState
  }

  try {
    return { ...defaultState, ...JSON.parse(raw) as PersistedState }
  } catch {
    return defaultState
  }
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedState>(() => readState())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo<AppStateValue>(
    () => ({
      region: state.region,
      cart: state.cart,
      favorites: state.favorites,
      searchQuery: state.searchQuery,
      setRegion: (region) => {
        setState((current) => ({ ...current, region }))
      },
      setSearchQuery: (value) => {
        setState((current) => ({ ...current, searchQuery: value }))
      },
      addToCart: (productId) => {
        setState((current) => {
          const existing = current.cart.find((item) => item.productId === productId)
          if (existing) {
            return {
              ...current,
              cart: current.cart.map((item) =>
                item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
              ),
            }
          }

          return {
            ...current,
            cart: [...current.cart, { productId, quantity: 1 }],
          }
        })
      },
      removeFromCart: (productId) => {
        setState((current) => ({
          ...current,
          cart: current.cart.filter((item) => item.productId !== productId),
        }))
      },
      changeQuantity: (productId, quantity) => {
        setState((current) => ({
          ...current,
          cart:
            quantity <= 0
              ? current.cart.filter((item) => item.productId !== productId)
              : current.cart.map((item) =>
                  item.productId === productId ? { ...item, quantity } : item,
                ),
        }))
      },
      toggleFavorite: (productId) => {
        setState((current) => ({
          ...current,
          favorites: current.favorites.includes(productId)
            ? current.favorites.filter((id) => id !== productId)
            : [...current.favorites, productId],
        }))
      },
      clearCart: () => {
        setState((current) => ({ ...current, cart: [] }))
      },
      cartCount: state.cart.reduce((sum, item) => sum + item.quantity, 0),
      favoritesCount: state.favorites.length,
    }),
    [state],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
