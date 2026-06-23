import { Check, Lock, Star, Trophy } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ACHIEVEMENT_LIST,
  type AchievementDefinition,
} from "@/lib/achievements";

type AchievementCard = AchievementDefinition & {
  progress: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
};

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const codes = ACHIEVEMENT_LIST.map((d) => d.code);

  // Подмешиваем прогресс пользователя к статичному реестру.
  // Запись в Achievement создаётся лениво (при первом bumpAchievement),
  // поэтому реестр — единственный надёжный источник полного списка.
  const dbAchievements = await prisma.achievement.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      users: {
        where: { userId },
        select: {
          progress: true,
          isUnlocked: true,
          unlockedAt: true,
        },
      },
    },
  });

  const userByCode = new Map(
    dbAchievements.map((a) => [a.code, a.users[0] ?? null]),
  );

  const cards: AchievementCard[] = ACHIEVEMENT_LIST.map((def) => {
    const row = userByCode.get(def.code) ?? null;
    return {
      ...def,
      progress: row?.progress ?? 0,
      isUnlocked: row?.isUnlocked ?? false,
      unlockedAt: row?.unlockedAt ?? null,
    };
  });

  const unlockedCount = cards.filter((c) => c.isUnlocked).length;
  const totalCount = cards.length;

  return (
    <div className="px-3">
      <div className="mb-6 flex items-center justify-between gap-x-4">
        <h1 className="text-2xl font-bold text-neutral-700">Достижения</h1>
        <div className="shrink-0 rounded-xl border-2 border-b-4 px-3 py-1.5 text-sm font-bold text-neutral-500">
          Открыто {unlockedCount} / {totalCount}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <AchievementCardView key={card.code} card={card} />
        ))}
      </div>
    </div>
  );
}

function AchievementCardView({ card }: { card: AchievementCard }) {
  const progressPct = Math.min(
    100,
    Math.round((card.progress / Math.max(1, card.targetValue)) * 100),
  );
  const inProgress = !card.isUnlocked && card.progress > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border-2 border-b-4 p-4",
        card.isUnlocked ? "border-green-200 bg-green-50" : "border-neutral-200",
      )}
    >
      <div className="flex items-start gap-x-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            card.isUnlocked
              ? "bg-green-500 text-white"
              : "bg-neutral-100 text-neutral-400",
          )}
        >
          {card.icon ? (
            <span className="text-2xl">{card.icon}</span>
          ) : (
            <Trophy className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-neutral-700">{card.title}</p>
          {card.isUnlocked ? (
            <span className="mt-1 inline-flex items-center gap-x-1 rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-600">
              <Check className="h-3 w-3 stroke-[3]" />
              Выполнено
            </span>
          ) : inProgress ? (
            <span className="mt-1 inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-600">
              В процессе
            </span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-x-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-400">
              <Lock className="h-3 w-3" />
              Закрыто
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-neutral-500">{card.description}</p>

      <div className="mt-auto flex flex-col gap-2">
        {card.targetValue > 1 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-400">
              <span>Прогресс</span>
              <span>
                {Math.min(card.progress, card.targetValue)} / {card.targetValue}
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}

        <div className="flex items-center justify-between">
          {card.rewardCurrency > 0 && (
            <span className="inline-flex items-center gap-x-1 text-sm font-bold text-orange-500">
              <Star className="h-4 w-4 fill-orange-400" />+{card.rewardCurrency}
            </span>
          )}
          {card.isUnlocked && card.unlockedAt && (
            <span className="text-xs text-neutral-400">
              {formatUnlockedAt(card.unlockedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatUnlockedAt(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
