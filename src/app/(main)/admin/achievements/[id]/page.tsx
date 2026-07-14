import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAdminOr404 } from "@/lib/server-guard";

import { AchievementForm } from "../achievement-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAchievementPage({ params }: PageProps) {
  await requireAdminOr404();

  const { id } = await params;
  const achievementId = Number.parseInt(id, 10);
  if (!Number.isFinite(achievementId) || achievementId <= 0) {
    notFound();
  }

  const [achievement, categories] = await Promise.all([
    prisma.achievement.findUnique({
      where: { id: achievementId },
      select: {
        id: true,
        title: true,
        description: true,
        icon: true,
        metric: true,
        categoryId: true,
        targetValue: true,
        rewardCurrency: true,
        isHidden: true,
        isActive: true,
        sortOrder: true,
      },
    }),
    prisma.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!achievement) {
    notFound();
  }

  return (
    <div className="px-3">
      <div className="mx-auto flex w-full max-w-[720px] flex-col">
        <h1 className="my-6 text-2xl font-bold text-neutral-700">
          Ачивка «{achievement.title}»
        </h1>
        <AchievementForm achievement={achievement} categories={categories} />
      </div>
    </div>
  );
}
