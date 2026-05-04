const faq = [
  'Как выбрать правильный регион аккаунта',
  'Как проходит выдача цифрового товара',
  'Что делать, если нужен срочный заказ',
  'Как восстановить доступ к оформленному заказу',
]

export function SupportPage() {
  return (
    <div className="page-shell section-space">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="satin-panel rounded-[32px] border border-white/10 p-6 lg:p-8">
          <div className="text-xs uppercase tracking-[0.24em] text-white/40">Support</div>
          <h1 className="mt-4 font-display text-5xl text-sheen">Поддержка без шума</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/58">
            Помогаем с регионами Turkey и India, активацией товаров, подбором подписок и вопросами по заказам.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/66">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">Поддержка по заказам и доступам: через рабочие контакты магазина</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">Регионы: Turkey и India</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">Среднее время ответа: до 10 минут</div>
          </div>
        </section>

        <section className="satin-panel rounded-[32px] border border-white/10 p-6 lg:p-8">
          <div className="text-xs uppercase tracking-[0.24em] text-white/40">FAQ</div>
          <div className="mt-6 space-y-4">
            {faq.map((item) => (
              <div key={item} className="rounded-[24px] border border-white/10 bg-white/4 px-5 py-5">
                <div className="text-lg text-white">{item}</div>
                <p className="mt-2 text-sm leading-6 text-white/54">
                  Краткое пояснение, которое затем можно заменить на реальную базу знаний или интегрировать с CMS.
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
