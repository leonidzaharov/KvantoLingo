import Link from "next/link";
import { Heart, Zap } from "lucide-react";

type UserProgressProps = {
  courseTitle: string;
  courseIcon: string | null;
  points: number;
  /** Сердца пока заглушка (в схеме нет поля) — появятся на Шаге C (миграция). */
  hearts: number;
};

export const UserProgress = ({
  courseTitle,
  courseIcon,
  points,
  hearts,
}: UserProgressProps) => {
  return (
    <div className="flex w-full items-center justify-between gap-x-2">
      <Link href="/courses">
        <div className="flex items-center gap-x-2 rounded-xl border-2 border-b-4 px-2.5 py-2 hover:bg-black/5 active:border-b-2">
          <span className="text-2xl">{courseIcon ?? "📚"}</span>
          <span className="font-bold text-neutral-700">{courseTitle}</span>
        </div>
      </Link>

      <div className="flex items-center gap-x-1 font-bold text-yellow-500">
        <Zap className="h-5 w-5 fill-yellow-400" />
        {points}
      </div>

      <div className="flex items-center gap-x-1 font-bold text-rose-500">
        <Heart className="h-5 w-5 fill-rose-500" />
        {hearts}
      </div>
    </div>
  );
};
