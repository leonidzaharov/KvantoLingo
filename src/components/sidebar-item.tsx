"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  Medal,
  Sparkles,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

// Иконку выбираем по строковому ключу, а не передаём компонент пропом —
// так серверный <Sidebar> не тянет lucide-компоненты через RSC-границу.
const ICONS: Record<string, LucideIcon> = {
  learn: BookOpen,
  courses: Compass,
  leaderboard: Medal,
  trophy: Trophy,
  profile: User,
  interesting: Sparkles,
};

type SidebarItemProps = {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
};

export const SidebarItem = ({ label, href, icon }: SidebarItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  const Icon = ICONS[icon];

  return (
    <Button
      variant={isActive ? "sidebarOutline" : "sidebar"}
      className="h-[52px] justify-start"
      asChild
    >
      <Link href={href}>
        <Icon className="mr-5 h-8 w-8" />
        {label}
      </Link>
    </Button>
  );
};
