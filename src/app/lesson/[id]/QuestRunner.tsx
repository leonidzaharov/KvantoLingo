"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import confetti from "canvas-confetti";

import { AchievementToastStack } from "@/components/AchievementToast";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import type { UnlockedAchievement } from "@/lib/achievements";
import {
  checkAnswer,
  completeLesson,
  recordCorrectAnswer,
  type CompleteLessonResult,
} from "@/lib/actions/gamification";
import { questionKind, type SafeLessonContent } from "@/lib/lesson-content";
import { outputsMatch } from "@/lib/output-match";
import { prewarmCode, runCode } from "@/lib/code-runner";

import { Challenge } from "./challenge";
import { CodeChallenge } from "./code-challenge";
import { Footer } from "./footer";
import { Header } from "./header";
import { ResultCard } from "./result-card";

// Сердца — клиентские: в схеме поля нет (появится на этапе миграции). Сейчас
// чисто визуальный счётчик, проигрыш урока при нуле НЕ блокируем.
const MAX_HEARTS = 5;

type Props = {
  lessonId: number;
  title: string;
  /** Контент без ответов (sanitizeLessonContent) — их проверяет сервер. */
  content: SafeLessonContent;
  /** Урок уже пройден раньше → это «тренировка», XP повторно не начислится. */
  alreadyCompleted: boolean;
  previewMode?: boolean;
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
  previewMode = false,
}: Props) {
  const questions = content.questions;
  const total = questions.length;
  const hasTheory = content.theory.trim() !== "";

  // Урок из двух частей: сначала теория (если есть), потом задания.
  const [phase, setPhase] = useState<"theory" | "tasks">(
    hasTheory ? "theory" : "tasks",
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | undefined>(
    undefined,
  );
  const [status, setStatus] = useState<"none" | "correct" | "wrong">("none");
  // Ответ проверяет сервер (checkAnswer) — на время запроса блокируем кнопку.
  const [checking, setChecking] = useState(false);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [completedCount, setCompletedCount] = useState(0);
  const [result, setResult] = useState<CompleteLessonResult | null>(null);
  const [toasts, setToasts] = useState<UnlockedAchievement[]>([]);
  const [isPending, startTransition] = useTransition();

  // Код ученика по номерам заданий (сохраняется при «Повторить» и при
  // возврате к заданию), вывод последнего запуска и флаг «выполняется».
  const [codeByIndex, setCodeByIndex] = useState<Record<number, string>>({});
  const [codeOutput, setCodeOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // Неудачные запуски по номерам заданий: после второй неудачи CodeChallenge
  // показывает ожидаемый вывод целиком (раньше — только подсказку без ответа).
  const [codeFailsByIndex, setCodeFailsByIndex] = useState<
    Record<number, number>
  >({});

  // Если в уроке есть код-задания — начинаем греть их движки заранее,
  // пока ученик читает теорию/отвечает на вопросы (тяжёлый только Python).
  useEffect(() => {
    for (const q of questions) {
      if (q.type === "code") prewarmCode(q.language);
    }
  }, [questions]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const challenge = questions[activeIndex];
  const kind = challenge ? questionKind(challenge) : "choice";
  const currentCode =
    kind === "code" && challenge?.type === "code"
      ? codeByIndex[activeIndex] ?? challenge.starterCode ?? ""
      : "";
  const percentage =
    total === 0 ? 100 : Math.round((completedCount / total) * 100);

  const onSelect = (index: number) => {
    if (status !== "none") return;
    setSelectedOption(index);
  };

  const finalize = () => {
    if (previewMode) {
      setResult({
        gainedXp: 0,
        gainedCoins: 0,
        totalXp: 0,
        level: 0,
        leveledUp: false,
        lastActiveDate: new Date(),
        firstCompletion: false,
        unlockedAchievements: [],
      });
      fireConfetti();
      return;
    }
    startTransition(async () => {
      try {
        // Перфект = ни одной потерянной жизни. Урок без заданий (total === 0)
        // перфектом не считается — там нечего было проходить без ошибок.
        const res = await completeLesson(lessonId, {
          perfect: total > 0 && hearts === MAX_HEARTS,
        });
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

  const markCorrect = () => {
    setStatus("correct");
    setCompletedCount((c) => c + 1);
    // Пошаговый прогресс фиксируем в фоне (только при первом прохождении).
    if (!alreadyCompleted && !previewMode) {
      void recordCorrectAnswer(lessonId).catch((err) =>
        console.error("recordCorrectAnswer failed", err),
      );
    }
  };

  const onContinue = () => {
    // Повтор после неверного — сброс к выбору (код ученика сохраняем).
    if (status === "wrong") {
      setStatus("none");
      setSelectedOption(undefined);
      return;
    }

    // «Далее» после верного — следующее задание или финал.
    if (status === "correct") {
      const isLast = activeIndex === total - 1;
      if (isLast) {
        finalize();
      } else {
        setActiveIndex((i) => i + 1);
        setStatus("none");
        setSelectedOption(undefined);
        setCodeOutput(null);
      }
      return;
    }

    if (!challenge) return;

    // «Проверить» для задания с кодом: запускаем код и сверяем вывод.
    if (kind === "code" && challenge.type === "code") {
      if (running) return;
      setRunning(true);
      void runCode(challenge.language, currentCode).then((res) => {
        setRunning(false);
        setCodeOutput(res.output);
        // Сравнение «мягкое»: кавычки, лишние пробелы, ё/е и пустые строки
        // по краям не считаются ошибкой (см. output-match.ts).
        const passed =
          res.ok && outputsMatch(res.output, challenge.expectedOutput);
        if (passed) {
          markCorrect();
        } else {
          setStatus("wrong");
          setHearts((h) => Math.max(0, h - 1));
          setCodeFailsByIndex((prev) => ({
            ...prev,
            [activeIndex]: (prev[activeIndex] ?? 0) + 1,
          }));
        }
      });
      return;
    }

    // «Проверить» для вопроса с вариантами. Правильный ответ знает только
    // сервер — спрашиваем его (в клиентском payload ответов больше нет).
    if (selectedOption === undefined || challenge.type === "code") return;
    if (checking) return;

    setChecking(true);
    void checkAnswer(lessonId, activeIndex, selectedOption)
      .then((correct) => {
        if (correct) {
          markCorrect();
        } else {
          setStatus("wrong");
          setHearts((h) => Math.max(0, h - 1));
        }
      })
      .catch((err) => {
        // Сеть моргнула — не засчитываем ни ответ, ни ошибку, пусть нажмёт ещё раз.
        console.error("checkAnswer failed", err);
      })
      .finally(() => setChecking(false));
  };

  // ── Экран результата ──
  if (result) {
    return (
      <>
        <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-y-4 px-6 text-center lg:gap-y-8">
          <div className="text-6xl lg:text-7xl">🎉</div>

          <h1 className="text-lg font-bold text-neutral-700 lg:text-3xl">
            {previewMode ? "Предпросмотр завершён" : "Отлично! Урок пройден."}
          </h1>

          {previewMode ? (
            <p className="text-neutral-500">
              Прогресс, XP, монеты и достижения не сохранялись.
            </p>
          ) : (
            <div className="flex w-full items-center gap-x-4">
              <ResultCard variant="points" value={result.gainedXp} />
              <ResultCard variant="coins" value={result.gainedCoins} />
              <ResultCard variant="hearts" value={hearts} />
            </div>
          )}

          {result.leveledUp && (
            <p className="text-base font-bold text-green-600 lg:text-lg">
              Новый уровень {result.level}! 🚀
            </p>
          )}
        </div>

        <Footer
          status="completed"
          onCheck={() => {
            window.location.href = previewMode
              ? `/admin/lessons/${lessonId}`
              : "/learn";
          }}
        />

        <AchievementToastStack achievements={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // ── Теория перед заданиями ──
  if (phase === "theory") {
    return (
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[720px] px-6 py-8">
            <p className="text-center text-xs font-bold uppercase tracking-wide text-neutral-400 lg:text-start">
              {previewMode
                ? "Предпросмотр · "
                : alreadyCompleted
                  ? "Тренировка · "
                  : ""}
              {title}
            </p>
            <Markdown>{content.theory}</Markdown>
          </div>
        </div>

        <Footer
          status="completed"
          disabled={isPending}
          onCheck={() => {
            // Урок без заданий: «Продолжить» сразу завершает урок.
            if (total === 0) {
              finalize();
            } else {
              setPhase("tasks");
            }
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

  // ── Урок без заданий и без теории (защита от пустого контента) ──
  if (total === 0) {
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-y-6 px-6 text-center">
        <h1 className="text-lg font-bold text-neutral-700 lg:text-2xl">
          В этом уроке пока нет заданий.
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
          <div className="flex w-full flex-col gap-y-12 px-6 py-8 lg:min-h-[350px] lg:w-[600px] lg:px-0">
            <div className="space-y-2">
              {alreadyCompleted && (
                <p className="text-center text-xs font-bold uppercase tracking-wide text-neutral-400 lg:text-start">
                  Тренировка · {title}
                </p>
              )}
              <h1 className="whitespace-pre-wrap text-center text-lg font-bold text-neutral-700 lg:text-start lg:text-3xl">
                {challenge.prompt}
              </h1>
            </div>

            {kind === "code" ? (
              <CodeChallenge
                code={currentCode}
                onChange={(code) =>
                  setCodeByIndex((prev) => ({ ...prev, [activeIndex]: code }))
                }
                language={
                  challenge.type === "code" ? challenge.language : "python"
                }
                output={codeOutput}
                running={running}
                status={status}
                expectedOutput={
                  challenge.type === "code" ? challenge.expectedOutput : ""
                }
                fails={codeFailsByIndex[activeIndex] ?? 0}
              />
            ) : (
              challenge.type !== "code" && (
                <Challenge
                  options={challenge.options}
                  onSelect={onSelect}
                  status={status}
                  selectedOption={selectedOption}
                  disabled={isPending}
                />
              )
            )}
          </div>
        </div>
      </div>

      <Footer
        status={status}
        onCheck={onContinue}
        disabled={
          isPending ||
          running ||
          checking ||
          (status === "none" &&
            (kind === "code"
              ? currentCode.trim() === ""
              : selectedOption === undefined))
        }
      />

      <AchievementToastStack achievements={toasts} onDismiss={dismissToast} />
    </>
  );
}
