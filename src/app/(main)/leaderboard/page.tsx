import { Medal } from "lucide-react";
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

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  // Топ по XP; тай-брейк — дата регистрации (кто раньше дошёл, тот выше).
  const users = await prisma.user.findMany({
    where: { isAdmin: false }, // наставник не соревнуется и не светится
    orderBy: [{ totalXp: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, totalXp: true },
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

                <p className="shrink-0 font-bold text-neutral-400">
                  {u.totalXp} XP
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
