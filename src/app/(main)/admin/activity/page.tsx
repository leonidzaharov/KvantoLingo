import { Activity, Coins, Zap } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAdminOr404 } from "@/lib/server-guard";

import { AdminNav } from "../admin-nav";

// «дд.мм, чч:мм» — компактно и достаточно, чтобы заметить пачку отметок,
// проставленных за одну минуту (признак «прокликал, не глядя»).
const fmtDateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Активность учеников: кто когда заходил и что отмечал «Изучил».
// Контроль тут социальный, а не программный: наставник видит паттерны
// (7 отметок за минуту) и разговаривает, код никого не наказывает.
export default async function AdminActivityPage() {
  await requireAdminOr404();

  const [users, studied] = await Promise.all([
    prisma.user.findMany({
      // Кто заходил недавно — сверху; кто ни разу — в самом низу.
      orderBy: { lastActiveDate: { sort: "desc", nulls: "last" } },
      select: {
        id: true,
        name: true,
        totalXp: true,
        currency: true,
        lastActiveDate: true,
        isAdmin: true,
      },
    }),
    prisma.userResource.findMany({
      orderBy: { studiedAt: "desc" },
      take: 30,
      select: {
        studiedAt: true,
        user: { select: { name: true } },
        resource: { select: { title: true, coinReward: true } },
      },
    }),
  ]);

  return (
    <div className="px-3">
      <div className="mx-auto flex w-full max-w-[900px] flex-col">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-600 text-white">
            <Activity className="h-10 w-10" />
          </div>
          <h1 className="my-2 text-center text-2xl font-bold text-neutral-700">
            Админка · Активность
          </h1>
          <p className="mb-6 text-center text-neutral-500">
            Кто когда заходил и что отмечал изученным.
          </p>
          <AdminNav active="activity" />
        </div>

        <h2 className="mb-3 mt-8 text-xl font-bold text-neutral-700">Ученики</h2>
        <ul className="flex flex-col gap-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border-2 border-neutral-200 p-4"
            >
              <span className="min-w-0 flex-1 truncate font-bold text-neutral-700">
                <Link
                  href={`/profile/${u.id}`}
                  className="hover:text-sky-600 hover:underline"
                >
                  {u.name}
                </Link>
                {u.isAdmin && (
                  <span className="ml-2 text-xs font-bold uppercase text-neutral-400">
                    админ
                  </span>
                )}
              </span>
              <span className="flex items-center gap-x-1 text-sm font-bold text-yellow-500">
                <Zap className="h-4 w-4 fill-yellow-400" />
                {u.totalXp}
              </span>
              <span className="flex items-center gap-x-1 text-sm font-bold text-amber-500">
                <Coins className="h-4 w-4 fill-amber-300" />
                {u.currency}
              </span>
              <span className="w-40 text-right text-sm font-bold text-neutral-400">
                {u.lastActiveDate
                  ? `был(а) ${fmtDateTime.format(u.lastActiveDate)}`
                  : "ещё не заходил(а)"}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mb-3 mt-8 text-xl font-bold text-neutral-700">
          Последние отметки «Изучил»
        </h2>
        {studied.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-neutral-200 px-6 py-8 text-center text-neutral-400">
            Пока никто ничего не отмечал.
          </p>
        ) : (
          <ul className="mb-8 flex flex-col gap-y-1.5">
            {studied.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-x-3 rounded-xl px-3 py-2 text-sm hover:bg-neutral-50"
              >
                <span className="w-24 shrink-0 font-bold text-neutral-400">
                  {fmtDateTime.format(s.studiedAt)}
                </span>
                <span className="shrink-0 font-bold text-neutral-700">
                  {s.user.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-500">
                  {s.resource.title}
                </span>
                <span className="flex shrink-0 items-center gap-x-0.5 font-bold text-amber-500">
                  +{s.resource.coinReward}
                  <Coins className="h-3.5 w-3.5 fill-amber-300" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
