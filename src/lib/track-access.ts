import type { GroupTrack } from "@/generated/prisma";
import { prisma } from "@/lib/db";

/**
 * Направление, которым ограничен пользователь при просмотре курсов.
 * null — видит все направления: наставник (правит всё) и ученик без
 * группы (новенький: лучше показать всё, чем пустой экран).
 *
 * Используется везде, где ученик добирается до курса/урока: /courses,
 * setActiveCourse, /learn и /lesson/[id] — чтобы группа видела только
 * модули своего направления и не могла обойти фильтр прямой ссылкой.
 */
export async function getTrackFilter(
  userId: string,
): Promise<GroupTrack | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, group: { select: { track: true } } },
  });
  if (!user || user.isAdmin) return null;
  return user.group?.track ?? null;
}
