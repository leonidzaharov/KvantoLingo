import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { ACTIVE_COURSE_COOKIE } from "@/lib/active-course";

import { List } from "./list";

export default async function CoursesPage() {
  const [categories, cookieStore] = await Promise.all([
    prisma.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, icon: true },
    }),
    cookies(),
  ]);

  const activeRaw = cookieStore.get(ACTIVE_COURSE_COOKIE)?.value;
  const activeCourseId = activeRaw ? Number(activeRaw) : undefined;

  return (
    <div className="mx-auto h-full max-w-[912px] px-3">
      <h1 className="text-2xl font-bold text-neutral-700">Выбор курса</h1>

      <List courses={categories} activeCourseId={activeCourseId} />
    </div>
  );
}
