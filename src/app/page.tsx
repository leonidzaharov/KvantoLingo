import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ProfileSelector } from "@/components/auth/ProfileSelector";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/learn");
  }

  const profiles = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      level: true,
    },
  });

  return <ProfileSelector profiles={profiles} />;
}
