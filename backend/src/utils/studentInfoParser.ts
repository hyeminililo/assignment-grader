import path from "node:path";
import type { StudentInfo } from "../types/grading.js";

export function parseStudentInfo(fileName: string): StudentInfo {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split("_").filter(Boolean);
  if (parts.length >= 3) {
    return {
      assignment: parts[0],
      name: parts.slice(1, -1).join("_"),
      studentId: parts[parts.length - 1],
      identifier: base,
      fileName
    };
  }
  return {
    name: base,
    studentId: base,
    identifier: base,
    fileName
  };
}

export function parseStudentInfoFromSource(sourceCode: string, fallback: StudentInfo): StudentInfo {
  const name = findSourceField(sourceCode, ["이름", "성명", "name"]);
  const studentId = findSourceField(sourceCode, ["학번", "번호", "studentId", "student id", "id"]);
  if (!name && !studentId) return fallback;

  return {
    ...fallback,
    name: name ?? fallback.name,
    studentId: studentId ?? fallback.studentId,
    identifier: studentId ?? fallback.identifier
  };
}

export function parseStudentInfoFromHtmlTitle(title: string, fallback: StudentInfo): StudentInfo {
  const match = title.trim().match(/^(.+?)_(.+?)_(.+)$/);
  if (!match) return fallback;
  return {
    ...fallback,
    assignment: match[1],
    name: match[2],
    studentId: match[3],
    identifier: match[3]
  };
}

export interface SourceMetadataCheck {
  field: string;
  found: boolean;
  value?: string;
}

export function checkRequiredSourceMetadata(sourceCode: string): SourceMetadataCheck[] {
  return [
    { field: "학기", labels: ["학기", "semester"] },
    { field: "과목", labels: ["과목", "교과목", "course", "subject"] },
    { field: "과제", labels: ["과제", "assignment"] },
    { field: "소속", labels: ["소속", "학과", "반", "department", "class"] },
    { field: "이름", labels: ["이름", "성명", "name"] },
    { field: "학번", labels: ["학번", "번호", "studentId", "student id", "id"] }
  ].map(({ field, labels }) => {
    const value = findSourceField(sourceCode, labels);
    return { field, found: Boolean(value), value };
  });
}

function findSourceField(sourceCode: string, labels: string[]): string | undefined {
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const patterns = [
    new RegExp(`(?:${escapedLabels})\\s*[:：=]\\s*([^\\n\\r,;*/]+)`, "i"),
    new RegExp(`(?:${escapedLabels})\\s+([^\\n\\r,;*/]+)`, "i")
  ];
  for (const pattern of patterns) {
    const found = sourceCode.match(pattern)?.[1]?.trim();
    if (found) return cleanSourceField(found);
  }
  return undefined;
}

function cleanSourceField(value: string): string {
  return value.replace(/^["'`]+|["'`]+$/g, "").trim();
}
