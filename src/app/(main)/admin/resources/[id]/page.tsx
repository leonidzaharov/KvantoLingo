import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAdminOr404 } from "@/lib/server-guard";

import { ResourceForm } from "../resource-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

// Правка существующего материала «Интересного». Только для наставника.
export default async function EditResourcePage({ params }: PageProps) {
  await requireAdminOr404();

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }

  const resource = await prisma.resource.findUnique({
    where: { id: numericId },
  });
  if (!resource) {
    notFound();
  }

  return (
    <div className="px-3">
      <div className="mx-auto flex w-full max-w-[600px] flex-col">
        <h1 className="my-4 text-2xl font-bold text-neutral-700">
          Правка материала
        </h1>
        <ResourceForm resource={resource} />
      </div>
    </div>
  );
}
