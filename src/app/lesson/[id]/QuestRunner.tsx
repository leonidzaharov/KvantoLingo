"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import confetti from "canvas-confetti";

import { AchievementToastStack } from "@/components/AchievementToast";
import { Button } from "@/components/ui/button";
import type { UnlockedAchievement } from "@/lib/achievements";
import {
  completeLesson,
  recordCorrectAnswer,
  type CompleteLessonResult,
} from "@/lib/actions/gamification";

import { Challenge } from "./challenge";
import { Footer } from "./footer";
import { Header } from "./header";
import { ResultCard } from "./result-card";

export type LessonQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type LessonContent = {
  questions: LessonQuestion[];
};

// Сердца — клиентские: в схеме поля нет (появится на этапе миграции). Сейчас
// чисто визуальный счётчик, проигрыш урока при нуле НЕ блокируем.
const MAX_HEARTS = 5;

type Props = {
  lessonId: number;
  title: string;
  content: LessonContent;
  /** Урок уже пройден раньше → это «тренировка», XP повторно не начислится. */
  alreadyCompleted: boolean;
};

function fireConfetti() {
  const burst = (origin: { x: number; y: number }) =>
    confetti({
      particleCount: 90,
      spread: 80,
      startVelocity: 45,
      origin,
      colors: ["#58cc02", "#4ade80", "#ffd900", "#ff9600", "#1cb0f6"],
      scalar: 1.1,
    });
  burst({ x: 0.2, y: 0.5 });
  burst({ x: 0.5, y: 0.4 });
  burst({ x: 0.8, y: 0.5 });
}

export function QuestRunner({
  lessonId,
  title,
  content,
  alreadyCompleted,
}: Props) {
  const questions = content.questions;
  const total = questions.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | undefined>(
    undefined,
  );
  const [status, setStatus] = useState<"none" | "correct" | "wrong">("none");
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [completedCount, setCompletedCount] = useState(0);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [toasts, setToasts] = useState<UnlockedAchievement[]>([]);
  const [isPending, startTransition] = useTransition();

  const dismissToast = useCallback((code: string) => {
    setToasts((prev) => prev.filter((t) => t.code !== code));
  }, []);

  const challenge = questions[activeIndex];
  const percentage = total === 0 ? 100 : Math.round((completedCount / total) * 100);

  const onSelect = (index: number) => {
    if (status !== "none") return;
    setSelectedOption(index);
  };

  const finalize = () => {
    startTransition(async () => {
      try {
        const res = await completeLesson(lessonId);
        setResult(res);
        if (res.unlockedAchievements.length > 0) {
          setToasts((prev) => [...prev, ...res.unlockedAchievements]);
        }
        fireConfetti();
      } catch (err) {
        console.error("completeLesson failed", err);
      }
    });
  };

  const onContinue = () => {
    // Повтор после неверного — сброс к выбору.
    if (status === "wrong") {
      setStatus("none");
      setSelectedOption(undefined);
      return;
    }

    // «Далее» после верного — следующий вопрос или финал.
    if (status === "correct") {
      const isLast = activeIndex === total - 1;
      if (isLast) {
        finalize();
      } else {
        setActiveIndex((i) => i + 1);
        setStatus("none");
        setSelectedOption(undefined);
      }
      return;
    }

    // «Проверить» — оценка выбранного варианта.
    if (selectedOption === undefined || !challenge) return;

    if (selectedOption === challenge.correctIndex) {
      setStatus("correct");
      setCompletedCount((c) => c + 1);
      // Пошаговый прогресс фиксируем в фоне (только при первом прохождении).
      if (!alreadyCompleted) {
        void recordCorrectAnswer(lessonId).catch((err) =>
          console.error("recordCorrectAnswer failed", err),
        );
      }
    } else {
      setStatus("wrong");
      setHearts((h) => Math.max(0, h - 1));
    }
  };

  // ── Экран результата ──
  if (result) {
    return (
      <>
        <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-y-4 px-6 text-center lg:gap-y-8">
          <div className="text-6xl lg:text-7xl">🎉</div>

          <h1 className="text-lg font-bold text-neutral-700 lg:text-3xl">
            Отлично! <br /> Урок пройден.
          </h1>

          <div className="flex w-full items-center gap-x-4">
            <ResultCard variant="points" value={result.gainedXp} />
            <ResultCard variant="hearts" value={hearts} />
          </div>

          {result.leveledUp && (
            <p className="text-base font-bold text-green-600 lg:text-lg">
              Новый уровень {result.level}! 🚀
            </p>
          )}
        </div>

        <Footer
          status="completed"
          onCheck={() => {
            window.location.href = "/learn";
          }}
        />

        <AchievementToastStack achievements={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // ── Жизни закончились ──
  // Клиентский фейл: жизни не персистятся, при повторном входе снова MAX_HEARTS.
  if (hearts <= 0) {
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-y-4 px-6 text-center lg:gap-y-6">
        <div className="text-6xl lg:text-7xl">💔</div>

        <h1 className="text-lg font-bold text-neutral-700 lg:text-3xl">
          Жизни закончились
        </h1>
        <p className="text-neutral-500">
          Не расстраивайся — попробуй пройти урок ещё раз.
        </p>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              window.location.href = `/lesson/${lessonId}`;
            }}
          >
            Попробовать снова
          </Button>
          <Button variant="default" size="lg" asChild>
            <Link href="/learn">Выйти</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Урок без вопросов (защита от пустого сидера) ──
  if (total === 0) {
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-y-6 px-6 text-center">
        <h1 className="text-lg font-bold text-neutral-700 lg:text-2xl">
          В этом уроке пока нет вопросов.
        </h1>
        <Button variant="secondary" size="lg" asChild>
          <Link href="/learn">Вернуться к курсу</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Header hearts={hearts} percentage={percentage} />

      <div className="flex-1">
        <div className="flex h-full items-center justify-center">
          <div className="flex w-full flex-col gap-y-12 px-6 lg:min-h-[350px] lg:w-[600px] lg:px-0">
            <div className="space-y-2">
              {alreadyCompleted && (
                <p className="text-center text-xs font-bold uppercase tracking-wide text-neutral-400 lg:text-start">
                  Тренировка · {title}
                </p>
              )}
              <h1 className="text-center text-lg font-bold text-neutral-700 lg:text-start lg:text-3xl">
                {challenge.prompt}
              </h1>
            </div>

            <Challenge
              options={challenge.options}
              onSelect={onSelect}
              status={status}
              selectedOption={selectedOption}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <Footer
        status={status}
        onCheck={onContinue}
        disabled={
          isPending || (status === "none" && selectedOption === undefined)
        }
      />

      <AchievementToastStack achievements={toasts} onDismiss={dismissToast} />
    </>
  );
}
