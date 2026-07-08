import Link from "next/link";

import { Button } from "@/components/ui/button";

const SECTIONS = [
  { key: "lessons", href: "/admin/lessons", label: "Уроки" },
  { key: "categories", href: "/admin/categories", label: "Курсы" },
  { key: "groups", href: "/admin/groups", label: "Группы" },
  { key: "resources", href: "/admin/resources", label: "Интересное" },
  { key: "activity", href: "/admin/activity", label: "Активность" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

// Единая навигация по разделам админки — рендерится под заголовком
// каждой админ-страницы, текущий раздел подсвечен.
export function AdminNav({ active }: { active: SectionKey }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {SECTIONS.map((s) => (
        <Button
          key={s.key}
          variant={s.key === active ? "secondary" : "ghost"}
          size="sm"
          asChild
        >
          <Link href={s.href}>{s.label}</Link>
        </Button>
      ))}
    </div>
  );
}
