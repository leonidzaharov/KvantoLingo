import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Кванториум",
  description: "Какие данные учеников собирает платформа и зачем.",
};

// Рендерим на каждый запрос: строгий CSP (см. src/proxy.ts) подписывает
// скрипты одноразовым nonce, а в статическую страницу его не вставить.
export const dynamic = "force-dynamic";

// Короткая, честная политика — платформа для детского кружка. Наставнику
// стоит подставить свои контакты/название организации в отмеченных местах
// и получить согласие родителей на обработку данных несовершеннолетних.
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold text-neutral-700 lg:text-3xl">
        Политика конфиденциальности
      </h1>

      <div className="mt-6 flex flex-col gap-y-5 font-medium text-neutral-600">
        <section>
          <h2 className="font-bold text-neutral-700">Какие данные мы храним</h2>
          <p>
            Имя ученика (как он подписан в группе), защищённый (захешированный)
            ПИН-код для входа, учебный прогресс — пройденные уроки, XP, уровень,
            монеты, достижения — и дату последнего входа.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-neutral-700">Зачем</h2>
          <p>
            Только чтобы платформа работала как помощник на занятиях: показывала
            прогресс, начисляла награды и помогала наставнику видеть, кто давно
            не занимался. Ничего лишнего мы не собираем.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-neutral-700">Где хранятся данные</h2>
          <p>
            В защищённой базе данных (Supabase). Доступ к ним есть только у
            наставника. Мы не продаём и не передаём данные третьим лицам и не
            используем их для рекламы.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-neutral-700">Дети</h2>
          <p>
            Платформа используется в детском кружке под руководством наставника.
            Обработка данных несовершеннолетних ведётся с согласия родителей
            (законных представителей).
          </p>
        </section>

        <section>
          <h2 className="font-bold text-neutral-700">Ваши права</h2>
          <p>
            Вы можете попросить показать или удалить данные ученика — обратитесь
            к наставнику{" "}
            <span className="text-neutral-400">
              (контакт: В MAX)
            </span>
            . По запросу мы удалим профиль и весь связанный прогресс.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Button variant="secondary" size="lg" asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
