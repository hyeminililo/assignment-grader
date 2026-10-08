import type { Assignment } from "../types/assignment";
import type { GradeJob, StudentGradeResult } from "../types/grading";

export async function startGrading(assignment: Assignment, files: File[], answerFile: File | undefined, concurrency: number): Promise<GradeJob> {
  const form = new FormData();
  form.append("assignment", JSON.stringify(assignment));
  form.append("concurrency", String(concurrency));
  files.forEach((file) => form.append("files", file));
  if (answerFile) form.append("answerFile", answerFile);
  const response = await fetch("/api/grade/start", { method: "POST", body: form });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json();
}

export async function getGradeJob(jobId: string): Promise<GradeJob> {
  const response = await fetch(`/api/grade/jobs/${jobId}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json();
}

export async function updateManualAdjustment(jobId: string, studentId: string, adjustment: number, reason: string): Promise<StudentGradeResult> {
  const response = await fetch(`/api/grade/jobs/${jobId}/manual-adjustments`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, adjustment, reason })
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.json();
}

export function csvUrl(jobId: string): string {
  return `/api/grade/jobs/${jobId}/csv`;
}

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text || `${response.status} ${response.statusText}`;
  }
}
