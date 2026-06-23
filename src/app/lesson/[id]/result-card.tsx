import { Heart, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

type ResultCardProps = {
  value: number;
  variant: "points" | "hearts";
};

export const ResultCard = ({ value, variant }: ResultCardProps) => {
  const Icon = variant === "points" ? Zap : Heart;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border-2",
        variant === "points" && "border-orange-400 bg-orange-400",
        variant === "hearts" && "border-rose-500 bg-rose-500",
      )}
    >
      <div
        className={cn(
          "rounded-t-xl p-1.5 text-center text-xs font-bold uppercase text-white",
          variant === "points" ? "bg-orange-400" : "bg-rose-500",
        )}
      >
        {variant === "hearts" ? "Сердца" : "Получено XP"}
      </div>

      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-white p-6 text-lg font-bold",
          variant === "points" ? "text-orange-400" : "text-rose-500",
        )}
      >
        <Icon
          className={cn(
            "mr-1.5 h-6 w-6",
            variant === "points" ? "fill-orange-400" : "fill-rose-500",
          )}
        />
        {value}
      </div>
    </div>
  );
};
