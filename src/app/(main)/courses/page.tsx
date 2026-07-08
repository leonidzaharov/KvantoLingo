import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ACTIVE_COURSE_COOKIE } from "@/lib/active-course";
import { TRACK_LABELS } from "@/lib/groups";
import { getTrackFilter } from "@/lib/track-access";

import { List } from "./list";

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  // Ученик видит только модули направления своей группы (наставник — все).
  const track = await getTrackFilter(session.user.id);

  const [categories, cookieStore] = await Promise.all([
    prisma.category.findMany({
      where: track ? { track } : undefined,
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
      {track && (
        <p className="mt-1 text-neutral-500">
          Направление твоей группы — {TRACK_LABELS[track].toLowerCase()}.
        </p>
      )}

      <List courses={categories} activeCourseId={activeCourseId} />
    </div>
  );
}
