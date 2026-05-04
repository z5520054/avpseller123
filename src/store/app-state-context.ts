import { createContext } from 'react'
import type { CartItem, EntityId, Region } from '../types'

export interface AppStateValue {
  region: Region
  cart: CartItem[]
  favorites: EntityId[]
  searchQuery: string
  setRegion: (region: Region) => void
  setSearchQuery: (value: string) => void
  addToCart: (productId: EntityId) => void
  removeFromCart: (productId: EntityId) => void
  changeQuantity: (productId: EntityId, quantity: number) => void
  toggleFavorite: (productId: EntityId) => void
  clearCart: () => void
  cartCount: number
  favoritesCount: number
}

export const AppStateContext = createContext<AppStateValue | null>(null)
