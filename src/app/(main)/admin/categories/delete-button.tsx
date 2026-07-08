"use client";

import { deleteCategory } from "@/lib/actions/categories";
import { Button } from "@/components/ui/button";

// Кнопка «Удалить» курса-модуля. Курс с уроками удалить нельзя — кнопка
// дизейблится с подсказкой (сервер это тоже проверяет).
export const DeleteButton = ({
  id,
  name,
  lessonCount,
}: {
  id: number;
  name: string;
  lessonCount: number;
}) => {
  const blocked = lessonCount > 0;
  return (
    <form
      action={deleteCategory}
      onSubmit={(e) => {
        if (!confirm(`Удалить курс «${name}»? Это действие не отменить.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="dangerOutline"
        size="sm"
        disabled={blocked}
        title={
          blocked
            ? `Внутри ${lessonCount} урок(ов) — сначала удали или перенеси их`
            : undefined
        }
      >
        Удалить
      </Button>
    </form>
  );
};
