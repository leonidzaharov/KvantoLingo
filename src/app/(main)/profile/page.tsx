import {
  BookOpen,
  Crown,
  Flame,
  LogOut,
  Medal,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACHIEVEMENT_LIST } from "@/lib/achievements";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const [user, lessonsCompleted, achievementsUnlocked] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        totalXp: true,
        level: true,
        currency: true,
        streakDays: true,
        createdAt: true,
      },
    }),
    prisma.userLessonProgress.count({ where: { userId, isCompleted: true } }),
    prisma.userAchievement.count({ where: { userId, isUnlocked: true } }),
  ]);

  if (!user) {
    redirect("/api/orphan-signout");
  }

  const joined = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(user.createdAt);
  const totalAchievements = ACHIEVEMENT_LIST.length;

  return (
    <div className="mx-auto max-w-[700px] px-3">
      <div className="flex flex-col items-center gap-y-3 pb-8 pt-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-3xl font-extrabold text-white">
          {initials(user.name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-700">{user.name}</h1>
          <p className="mt-1 text-sm font-bold text-neutral-400">
            В Кванториуме с {joined}
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-bold text-neutral-700">Статистика</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Flame}
          iconClass="text-orange-500 fill-orange-400"
          value={user.streakDays}
          label="Дней подряд"
        />
        <StatCard
          icon={Zap}
          iconClass="text-yellow-500 fill-yellow-400"
          value={user.totalXp}
          label="Всего XP"
        />
        <StatCard
          icon={Crown}
          iconClass="text-amber-500 fill-amber-400"
          value={user.level}
          label="Уровень"
        />
        <StatCard
          icon={BookOpen}
          iconClass="text-green-500"
          value={lessonsCompleted}
          label="Уроков пройдено"
        />
        <StatCard
          icon={Medal}
          iconClass="text-sky-500"
          value={`${achievementsUnlocked} / ${totalAchievements}`}
          label="Достижения"
        />
        <StatCard
          icon={Star}
          iconClass="text-orange-500 fill-orange-400"
          value={user.currency}
          label="Монеты"
        />
      </div>

      <div className="mt-8">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button
            type="submit"
            variant="default"
            className="w-full text-rose-500 sm:w-auto"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Выйти
          </Button>
        </form>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  value,
  label,
}: {
  icon: LucideIcon;
  iconClass: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-x-3 rounded-xl border-2 border-b-4 p-4">
      <Icon className={cn("h-7 w-7 shrink-0", iconClass)} />
      <div className="min-w-0">
        <p className="text-lg font-extrabold leading-none text-neutral-700">
          {value}
        </p>
        <p className="mt-1 text-xs font-bold text-neutral-400">{label}</p>
      </div>
    </div>
  );
}
