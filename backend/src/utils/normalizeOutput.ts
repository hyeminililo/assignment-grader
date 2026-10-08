import type { ComparisonMode } from "../types/assignment.js";

export function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().replace(/[ \t]+/g, " ");
}

export function compareOutput(actual: string, expected: string, mode: ComparisonMode): boolean {
  if (mode === "EXACT") return actual === expected;
  if (mode === "NORMALIZED") return normalizeOutput(actual) === normalizeOutput(expected);
  return normalizeOutput(actual).includes(normalizeOutput(expected));
}

export function compareConsoleOutput(actual: string, expected: string, mode: ComparisonMode): boolean {
  if (compareOutput(actual, expected, mode)) return true;
  const actualResult = normalizeConsoleResult(actual);
  const expectedResult = normalizeConsoleResult(expected);
  if (mode === "EXACT") return actualResult === expectedResult;
  if (mode === "NORMALIZED") return actualResult === expectedResult;
  return actualResult.includes(expectedResult);
}

export function normalizeConsoleResult(value: string): string {
  return normalizeOutput(
    value
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(stripPromptFragments)
      .join("\n")
  );
}

function stripPromptFragments(line: string): string {
  let next = line;
  let previous = "";
  while (next !== previous) {
    previous = next;
    next = next.replace(/[^>＞\n]*(?:>>+|＞＞+|>|＞)\s*/g, "");
    next = next.replace(/[^:：\n]*(?:입력|입력하세요|하세요|몇|값|정수|문자|분|월|일|년도)[^:：\n]*[:：]\s*/g, "");
  }
  return next;
}
