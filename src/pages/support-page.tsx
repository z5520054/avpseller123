const faq = [
  {
    question: 'Вы оформите игру на мой аккаунт?',
    answer: 'Мы продаём коды пополнения. Все товары в каталоге представлены для наглядности и удобства. После оплаты мы пришлём коды и расскажем, как активировать их на вашем аккаунте.',
  },
  {
    question: 'Как проходит оформление заказа?',
    answer: 'После оплаты мы вышлем вам код пополнения, которого будет достаточно для оплаты выбранных вами товаров в PS Store.',
  },
  {
    question: 'Как сделать заказ?',
    answer: 'Выберите желаемые игры и положите их в корзину — там автоматически появится нужное количество кодов пополнения.',
  },
  {
    question: 'А как активировать код пополнения?',
    answer: 'Это достаточно просто и можно сделать как с консоли, так и через браузер. Мы вышлем подробную инструкцию после оплаты.',
  },
  {
    question: 'Как оформить подписку?',
    answer: 'Добавляете нужный тариф в корзину, оплачиваете, далее мы высылаем инструкцию по указанным контактам и помогаем активировать подписку.',
  },
]

export function SupportPage() {
  return (
    <div className="page-shell section-space">
      <div className="grid gap-5 lg:grid-cols-[0.78fr_0.95fr]">
        <section className="satin-panel rounded-[26px] border border-white/10 p-5 sm:rounded-[30px] sm:p-8 lg:min-h-[620px]">
          <div className="text-xs uppercase tracking-[0.28em] text-white/36">Support</div>
          <h1 className="mt-5 font-display text-4xl leading-none text-sheen sm:text-6xl">Поддержка</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/58 sm:mt-6 sm:text-base sm:leading-8">
            Помогаем с регионами Turkey и India, активацией товаров, подбором подписок и вопросами по заказам.
          </p>
          <div className="mt-9 space-y-3 text-sm font-medium text-white/64">
            <a
              href="tg://resolve?domain=avpsellersupport"
              className="block rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              Связаться с поддержкой
            </a>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4">Среднее время ответа: до 10 минут</div>
          </div>
        </section>

        <section className="satin-panel rounded-[26px] border border-white/10 p-4 sm:rounded-[30px] sm:p-8">
          <div className="text-xs uppercase tracking-[0.28em] text-white/36">FAQ</div>
          <div className="mt-6 space-y-4 sm:mt-7">
            {faq.map((item) => (
              <div key={item.question} className="rounded-[24px] border border-white/10 bg-white/[0.045] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:px-6 sm:py-6">
                <div className="text-lg font-semibold text-white">{item.question}</div>
                <p className="mt-3 text-sm leading-7 text-white/54">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
