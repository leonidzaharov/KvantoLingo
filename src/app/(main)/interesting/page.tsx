import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { ResourceCard } from "./card";
import { RESOURCES } from "./resources";

export default async function InterestingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="px-3">
      <div className="mx-auto flex w-full max-w-[900px] flex-col items-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-400 text-white">
          <Sparkles className="h-10 w-10" />
        </div>

        <h1 className="my-2 text-center text-2xl font-bold text-neutral-700">
          Интересное
        </h1>
        <p className="mb-6 text-center text-neutral-500">
          Видео, проекты и ссылки, чтобы пробовать новое за пределами уроков.
        </p>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {RESOURCES.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </div>
    </div>
  );
}
