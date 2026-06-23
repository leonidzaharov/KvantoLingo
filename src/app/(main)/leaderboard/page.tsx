import { Flame, Medal, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

type SortKey = "xp" | "streak";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const { sort } = await searchParams;
  const sortKey: SortKey = sort === "streak" ? "streak" : "xp";

  // Сортировку выбираем по вкладке. Тай-брейки: для стрика — по XP, затем дате;
  // для XP — по дате регистрации (кто раньше дошёл, тот выше).
  const users = await prisma.user.findMany({
    orderBy:
      sortKey === "streak"
        ? [{ streakDays: "desc" }, { totalXp: "desc" }, { createdAt: "asc" }]
        : [{ totalXp: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, totalXp: true, streakDays: true },
    take: 10,
  });

  return (
    <div className="px-3">
      <div className="flex w-full flex-col items-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-400 text-white">
          <Medal className="h-10 w-10" />
        </div>

        <h1 className="my-2 text-center text-2xl font-bold text-neutral-700">
          Лидерборд
        </h1>
        <p className="mb-6 text-center text-neutral-500">
          Сравни свой прогресс с другими учениками.
        </p>

        <div className="w-full max-w-[600px]">
          {/* Сегментированный переключатель — обычные ссылки, RSC-навигация */}
          <div className="mb-5 flex gap-1 rounded-xl border-2 p-1">
            <TabLink
              active={sortKey === "xp"}
              href="/leaderboard?sort=xp"
              label="По XP"
              icon={Zap}
            />
            <TabLink
              active={sortKey === "streak"}
              href="/leaderboard?sort=streak"
              label="По стрику"
              icon={Flame}
            />
          </div>

          {users.map((u, i) => {
            const isMe = u.id === userId;
            const rankColor =
              i === 0
                ? "text-amber-500"
                : i === 1
                  ? "text-neutral-400"
                  : i === 2
                    ? "text-orange-700"
                    : "text-neutral-500";

            return (
              <div
                key={u.id}
                className={cn(
                  "flex w-full items-center rounded-xl p-2 px-4",
                  isMe ? "bg-green-100" : "hover:bg-neutral-100",
                )}
              >
                <p
                  className={cn("mr-4 w-6 text-center font-extrabold", rankColor)}
                >
                  {i + 1}
                </p>

                <div className="ml-2 mr-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500 font-extrabold text-white">
                  {initials(u.name)}
                </div>

                <p className="flex-1 truncate font-bold text-neutral-700">
                  {u.name}
                  {isMe && (
                    <span className="ml-2 text-xs font-bold text-green-600">
                      (ты)
                    </span>
                  )}
                </p>

                {sortKey === "streak" ? (
                  <p className="flex shrink-0 items-center gap-x-1 font-bold text-orange-500">
                    <Flame className="h-4 w-4 fill-orange-400" />
                    {u.streakDays}
                  </p>
                ) : (
                  <p className="shrink-0 font-bold text-neutral-400">
                    {u.totalXp} XP
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabLink({
  active,
  href,
  label,
  icon: Icon,
}: {
  active: boolean;
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 items-center justify-center gap-x-1.5 rounded-lg py-2 text-sm font-bold transition",
        active
          ? "bg-green-500 text-white"
          : "text-neutral-500 hover:bg-neutral-100",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
