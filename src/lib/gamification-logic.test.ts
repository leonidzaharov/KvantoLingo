import { describe, expect, it } from "vitest";

import {
  calculateLevel,
  countQuestions,
  fullDaysBetween,
  nextStreak,
} from "./gamification-logic";

describe("calculateLevel", () => {
  it("0 XP — это уровень 1 (стартовый)", () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it("99 XP всё ещё уровень 1, 100 XP — уже уровень 2", () => {
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
  });

  it("растёт по 100 XP на уровень", () => {
    expect(calculateLevel(250)).toBe(3);
    expect(calculateLevel(600)).toBe(7);
  });
});

describe("fullDaysBetween", () => {
  it("один и тот же день → 0 (даже если разное время)", () => {
    const a = new Date("2026-06-26T01:00:00Z");
    const b = new Date("2026-06-26T23:59:00Z");
    expect(fullDaysBetween(a, b)).toBe(0);
  });

  it("соседние календарные дни → 1", () => {
    const a = new Date("2026-06-26T23:00:00Z");
    const b = new Date("2026-06-27T01:00:00Z");
    expect(fullDaysBetween(a, b)).toBe(1);
  });

  it("считает по UTC-дням, а не по 24-часовым промежуткам", () => {
    // разница всего ~2 часа, но это разные сутки → 1 день, не 0
    const a = new Date("2026-06-26T22:00:00Z");
    const b = new Date("2026-06-28T00:30:00Z");
    expect(fullDaysBetween(a, b)).toBe(2);
  });
});

describe("nextStreak", () => {
  const now = new Date("2026-06-26T12:00:00Z");

  it("первая активность вообще → стрик 1", () => {
    expect(nextStreak(null, 0, now)).toBe(1);
  });

  it("повторная активность в тот же день → стрик не меняется", () => {
    const sameDay = new Date("2026-06-26T08:00:00Z");
    expect(nextStreak(sameDay, 4, now)).toBe(4);
  });

  it("активность на следующий день → +1", () => {
    const yesterday = new Date("2026-06-25T20:00:00Z");
    expect(nextStreak(yesterday, 4, now)).toBe(5);
  });

  it("пропуск двух и более дней → сброс в 0", () => {
    const threeDaysAgo = new Date("2026-06-23T12:00:00Z");
    expect(nextStreak(threeDaysAgo, 9, now)).toBe(0);
  });
});

describe("countQuestions", () => {
  it("считает элементы массива questions", () => {
    const content = JSON.stringify({ questions: [{}, {}, {}] });
    expect(countQuestions(content)).toBe(3);
  });

  it("нет поля questions → 0", () => {
    expect(countQuestions(JSON.stringify({ title: "урок" }))).toBe(0);
  });

  it("кривой JSON → 0, без падения", () => {
    expect(countQuestions("{не json")).toBe(0);
  });
});
