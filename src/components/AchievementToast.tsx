"use client";

import { useEffect } from "react";

import type { UnlockedAchievement } from "@/lib/achievements";

import "./AchievementToast.css";

const AUTO_DISMISS_MS = 6000;

type Props = {
  achievements: UnlockedAchievement[];
  onDismiss: (code: string) => void;
};

/**
 * Стек pixel-art тостов «достижение разблокировано». Рендерится
 * `position: fixed`, поэтому ему всё равно, в какое место DOM-дерева
 * его положили — главное, чтобы рядом был стилевой контекст из
 * lesson.css (там лежат .achievement-toast-* классы).
 *
 * Каждый тост сам себя удаляет через AUTO_DISMISS_MS, либо по крестику.
 */
export function AchievementToastStack({ achievements, onDismiss }: Props) {
  if (achievements.length === 0) return null;

  return (
    <div
      className="achievement-toast-stack"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {achievements.map((a) => (
        <Toast key={a.code} achievement={a} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({
  achievement,
  onDismiss,
}: {
  achievement: UnlockedAchievement;
  onDismiss: (code: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(achievement.code),
      AUTO_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [achievement.code, onDismiss]);

  return (
    <div className="achievement-toast" role="alert">
      <div className="achievement-toast-rune" aria-hidden="true">
        ◆
      </div>

      <div className="achievement-toast-body">
        <div className="achievement-toast-label">ДОСТИЖЕНИЕ ОТКРЫТО</div>
        <div className="achievement-toast-title">{achievement.title}</div>
        <div className="achievement-toast-desc">{achievement.description}</div>
        {achievement.rewardCurrency > 0 && (
          <div className="achievement-toast-reward">
            +{achievement.rewardCurrency} ◈
          </div>
        )}
      </div>

      <button
        type="button"
        className="achievement-toast-dismiss"
        aria-label="Скрыть уведомление"
        onClick={() => onDismiss(achievement.code)}
      >
        ×
      </button>
    </div>
  );
}
