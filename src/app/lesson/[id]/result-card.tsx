import { Coins, Heart, Zap, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "points" | "coins" | "hearts";

// Стили и подпись каждой карточки итогов урока.
const VARIANT_META: Record<
  Variant,
  { icon: LucideIcon; label: string; frame: string; text: string; fill: string }
> = {
  points: {
    icon: Zap,
    label: "Получено XP",
    frame: "border-orange-400 bg-orange-400",
    text: "text-orange-400",
    fill: "fill-orange-400",
  },
  coins: {
    icon: Coins,
    label: "Монеты",
    frame: "border-amber-400 bg-amber-400",
    text: "text-amber-500",
    fill: "fill-amber-400",
  },
  hearts: {
    icon: Heart,
    label: "Сердца",
    frame: "border-rose-500 bg-rose-500",
    text: "text-rose-500",
    fill: "fill-rose-500",
  },
};

type ResultCardProps = {
  value: number;
  variant: Variant;
};

export const ResultCard = ({ value, variant }: ResultCardProps) => {
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;

  return (
    <div className={cn("w-full rounded-2xl border-2", meta.frame)}>
      <div className="rounded-t-xl p-1.5 text-center text-xs font-bold uppercase text-white">
        {meta.label}
      </div>

      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-white p-6 text-lg font-bold",
          meta.text,
        )}
      >
        <Icon className={cn("mr-1.5 h-6 w-6", meta.fill)} />
        {value}
      </div>
    </div>
  );
};
