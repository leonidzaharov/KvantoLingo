"use client";

import { useState, useTransition } from "react";

import { assignStudentGroup } from "@/lib/actions/groups";
import { TRACK_LABELS } from "@/lib/groups";
import type { GroupTrack } from "@/generated/prisma";

type GroupOption = {
  id: number;
  name: string;
  track: GroupTrack;
};

type Props = {
  student: { id: string; name: string; groupId: number | null };
  groups: GroupOption[];
};

// Строка ученика с выпадающим списком групп: смена значения сразу
// сохраняется на сервере (без отдельной кнопки «Сохранить»).
export function StudentRow({ student, groups }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const onChange = (value: string) => {
    setError(false);
    const groupId = value === "" ? null : Number(value);
    startTransition(async () => {
      try {
        await assignStudentGroup({ userId: student.id, groupId });
      } catch {
        setError(true);
      }
    });
  };

  return (
    <li className="flex items-center gap-x-4 rounded-2xl border-2 border-neutral-200 p-3">
      <span className="min-w-0 flex-1 truncate font-bold text-neutral-700">
        {student.name}
      </span>
      {error && (
        <span className="text-sm font-bold text-rose-500">
          Не сохранилось — попробуй ещё раз
        </span>
      )}
      <select
        aria-label={`Группа для ${student.name}`}
        defaultValue={student.groupId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className="rounded-xl border-2 bg-neutral-50 px-3 py-2 font-bold outline-none focus:border-green-400 disabled:opacity-50"
      >
        <option value="">Без группы</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} · {TRACK_LABELS[g.track]}
          </option>
        ))}
      </select>
    </li>
  );
}
