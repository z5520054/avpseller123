import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppStateProvider } from './store/app-state'
import { AccountPage } from './pages/account-page'
import { AdminPsPlusPage } from './pages/admin-ps-plus-page'
import { RootLayout } from './components/root-layout'
import { ScrollToTop } from './components/scroll-to-top'
import { CartPage } from './pages/cart-page'
import { CatalogPage } from './pages/catalog-page'
import { CheckoutPage } from './pages/checkout-page'
import { FavoritesPage } from './pages/favorites-page'
import { HomePage } from './pages/home-page'
import { OrderReturnPage } from './pages/order-return-page'
import { ProductPage } from './pages/product-page'
import { SupportPage } from './pages/support-page'

function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <ScrollToTop />
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/product/:productId" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders/:orderId" element={<OrderReturnPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/admin" element={<AdminPsPlusPage />} />
            <Route path="/admin/ps-plus" element={<AdminPsPlusPage />} />
          </Route>
        </Routes>
      </AppStateProvider>
    </BrowserRouter>
  )
}

export default App
