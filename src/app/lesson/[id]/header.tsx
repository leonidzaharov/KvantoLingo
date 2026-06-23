import { Heart, X } from "lucide-react";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";

type HeaderProps = {
  hearts: number;
  percentage: number;
};

export const Header = ({ hearts, percentage }: HeaderProps) => {
  return (
    <header className="mx-auto flex w-full max-w-[1140px] items-center justify-between gap-x-7 px-6 pt-[20px] lg:px-10 lg:pt-[50px]">
      <Link href="/learn" aria-label="Выйти из урока">
        <X className="cursor-pointer text-slate-500 transition hover:opacity-75" />
      </Link>

      <Progress value={percentage} />

      <div className="flex items-center font-bold text-rose-500">
        <Heart className="mr-2 h-6 w-6 fill-rose-500" />
        {hearts}
      </div>
    </header>
  );
};
