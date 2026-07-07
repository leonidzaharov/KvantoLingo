import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ProfileSelector } from "@/components/auth/ProfileSelector";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/learn");
  }

  // Наставников в списках нет: их аккаунт — цель для подбора PIN, поэтому
  // ученики не должны видеть, что он существует. Вход наставника — /mentor.
  const [groups, ungrouped] = await Promise.all([
    prisma.group.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        track: true,
        students: {
          where: { isAdmin: false },
          orderBy: { name: "asc" },
          select: { id: true, name: true, level: true },
        },
      },
    }),
    // Ученики без группы (новенькие) — иначе им было бы не войти вовсе.
    prisma.user.findMany({
      where: { isAdmin: false, groupId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, level: true },
    }),
  ]);

  return <ProfileSelector groups={groups} ungrouped={ungrouped} />;
}
