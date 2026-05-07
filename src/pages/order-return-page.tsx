import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrder } from '../lib/catalog-api'
import { rememberOrder } from '../lib/order-history'

export function OrderReturnPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Проверяем заказ и открываем историю покупок...')

  useEffect(() => {
    const id = Number(orderId)
    if (!Number.isFinite(id)) {
      navigate('/account?section=purchases', { replace: true })
      return
    }

    rememberOrder(id)
    getOrder(id)
      .then((order) => {
        rememberOrder(order)
        navigate(`/account?section=purchases&order=${order.id}`, { replace: true })
      })
      .catch(() => {
        setMessage('Заказ сохранён локально. Открываем историю покупок...')
        window.setTimeout(() => {
          navigate(`/account?section=purchases&order=${id}`, { replace: true })
        }, 700)
      })
  }, [navigate, orderId])

  return (
    <div className="page-shell section-space">
      <div className="satin-panel rounded-[30px] border border-white/10 px-6 py-14 text-center">
        <div className="font-display text-3xl text-sheen">Возврат после оплаты</div>
        <p className="mt-4 text-sm text-white/56">{message}</p>
      </div>
    </div>
  )
}
