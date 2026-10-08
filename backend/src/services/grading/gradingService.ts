import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { safeUnzip } from "../archive/safeUnzip.js";
import { createTempDirectory, removeDirectory } from "../../utils/tempDirectory.js";
import type { Assignment } from "../../types/assignment.js";
import type { AssignmentGrader, GradeJob, StudentGradeResult } from "../../types/grading.js";
import { JavaAssignmentGrader } from "../java/javaGrader.js";
import { WebAssignmentGrader } from "../web/webGrader.js";
import { parseStudentInfo, parseStudentInfoFromSource } from "../../utils/studentInfoParser.js";
import { scanProject } from "../archive/projectScanner.js";

export interface UploadedStudentFile {
  path: string;
  originalname: string;
}

export interface UploadedAnswerFile {
  path: string;
  originalname: string;
}

export class GradingService {
  private jobs = new Map<string, GradeJob>();
  private emitters = new Map<string, EventEmitter>();

  startJob(assignment: Assignment, files: UploadedStudentFile[], answerFile?: UploadedAnswerFile, concurrency = 2): GradeJob {
    const job: GradeJob = {
      id: randomUUID(),
      assignment,
      progress: { total: files.length, completed: 0, status: "queued" },
      results: [],
      createdAt: new Date().toISOString()
    };
    console.info("[grading] start job", {
      jobId: job.id,
      assignmentType: assignment.type,
      title: assignment.title,
      files: files.map((file) => file.originalname),
      answerFile: answerFile?.originalname,
      concurrency
    });
    this.jobs.set(job.id, job);
    this.emitters.set(job.id, new EventEmitter());
    void this.runJob(job.id, files, answerFile, Math.max(1, Math.min(concurrency, 4)));
    return job;
  }

  getJob(id: string): GradeJob | undefined {
    return this.jobs.get(id);
  }

  getEmitter(id: string): EventEmitter | undefined {
    return this.emitters.get(id);
  }

  updateManualAdjustment(jobId: string, studentId: string, adjustment: number, reason: string): StudentGradeResult | undefined {
    const result = this.jobs.get(jobId)?.results.find((item) => item.student.studentId === studentId);
    if (!result) return undefined;
    result.manualAdjustment = adjustment;
    result.manualReason = reason;
    result.finalScore = Math.max(0, Math.min(result.maxScore, result.autoScore + adjustment));
    return result;
  }

  toCsv(jobId: string): string | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    const problemNames = job.assignment.problems.map((problem) => problem.name);
    const headers = ["studentId", "name", "autoScore", "manualAdjustment", "finalScore", "status", ...problemNames];
    const rows = job.results.map((result) => {
      const problemScores = job.assignment.problems.map((problem) => {
        const found = result.problemResults.find((item) => item.problemId === problem.id);
        return found ? `${found.score}/${found.maxScore}` : "";
      });
      return [result.student.studentId, result.student.name, result.autoScore, result.manualAdjustment, result.finalScore, result.status, ...problemScores].map(csvCell).join(",");
    });
    return [headers.join(","), ...rows].join("\n");
  }

  private async runJob(jobId: string, files: UploadedStudentFile[], answerFile: UploadedAnswerFile | undefined, concurrency: number): Promise<void> {
    const job = this.jobs.get(jobId);
    const emitter = this.emitters.get(jobId);
    if (!job || !emitter) return;
    const grader: AssignmentGrader = job.assignment.type === "JAVA" ? new JavaAssignmentGrader() : new WebAssignmentGrader();
    const answerTempDir = answerFile ? await createTempDirectory("assignment-answer") : undefined;
    const answerProjectPath = answerTempDir ? path.join(answerTempDir, "project") : undefined;
    let index = 0;
    job.progress.status = "running";
    emitter.emit("progress", job.progress);

    try {
      if (answerFile && answerProjectPath) {
        console.info("[grading] prepare answer file", { jobId, file: answerFile.originalname });
        await prepareUploadedProject(answerFile, answerProjectPath);
      }
    } catch (error) {
      console.error("[grading] answer file prepare failed", { jobId, file: answerFile?.originalname, error });
      job.progress.status = "failed";
      job.progress.message = error instanceof Error ? error.message : "답안 ZIP 압축 해제 중 오류가 발생했습니다.";
      emitter.emit("progress", job.progress);
      if (answerFile) await fs.rm(answerFile.path, { force: true });
      if (answerTempDir) await removeDirectory(answerTempDir);
      return;
    }

    const worker = async () => {
      while (index < files.length) {
        const file = files[index++];
        let student = parseStudentInfo(file.originalname);
        job.progress.current = student;
        emitter.emit("progress", job.progress);
        const tempDir = await createTempDirectory("assignment-grader");
        const extractDir = path.join(tempDir, "project");
        try {
          console.info("[grading] prepare student file", { jobId, file: file.originalname });
          await prepareUploadedProject(file, extractDir);
          student = await parseStudentInfoFromProject(extractDir, student);
          job.progress.current = student;
          emitter.emit("progress", job.progress);
          console.info("[grading] grade student", { jobId, file: file.originalname, student });
          const result = await grader.grade(extractDir, job.assignment, file.originalname, answerProjectPath);
          result.student = parseStudentInfoFromSourceCandidates(result.student, student);
          job.results.push(result);
          console.info("[grading] student done", { jobId, file: file.originalname, status: result.status, score: result.finalScore, maxScore: result.maxScore });
        } catch (error) {
          console.error("[grading] student failed", { jobId, file: file.originalname, student, error });
          const reason = error instanceof Error ? error.message : "Unknown grading error";
          const maxScore = job.assignment.problems.reduce((sum, problem) => sum + problem.points, 0);
          job.results.push({
            student,
            status: "SYSTEM_ERROR",
            autoScore: 0,
            manualAdjustment: 0,
            manualReason: "",
            finalScore: 0,
            maxScore,
            problemResults: job.assignment.problems.map((problem) => ({
              problemId: problem.id,
              problemName: problem.name,
              status: "SYSTEM_ERROR",
              score: 0,
              maxScore: problem.points,
              ruleResults: [{ id: "system", label: problem.name, status: "SYSTEM_ERROR", score: 0, maxScore: problem.points, reason }]
            }))
          });
        } finally {
          await removeDirectory(tempDir);
          await fs.rm(file.path, { force: true });
          job.progress.completed += 1;
          emitter.emit("progress", job.progress);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
      job.results.sort((a, b) => a.student.studentId.localeCompare(b.student.studentId, "ko"));
      job.progress.status = "done";
      job.progress.current = undefined;
      emitter.emit("progress", job.progress);
      console.info("[grading] job done", { jobId, results: job.results.length });
    } finally {
      if (answerFile) await fs.rm(answerFile.path, { force: true });
      if (answerTempDir) await removeDirectory(answerTempDir);
    }
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

async function prepareUploadedProject(file: UploadedStudentFile | UploadedAnswerFile, destination: string): Promise<void> {
  const extension = path.extname(file.originalname).toLowerCase();
  console.info("[grading] prepare uploaded project", { file: file.originalname, extension, destination });
  await fs.mkdir(destination, { recursive: true });
  if (extension === ".zip") {
    await safeUnzip(file.path, destination);
    return;
  }
  if (isSupportedSourceFile(extension)) {
    await fs.copyFile(file.path, path.join(destination, path.basename(file.originalname)));
    return;
  }
  throw new Error(`지원하지 않는 파일 형식입니다: ${file.originalname}. ZIP 또는 소스 파일을 업로드하세요.`);
}

function isSupportedSourceFile(extension: string): boolean {
  return [".java", ".html", ".htm", ".css", ".js", ".jsp", ".xml"].includes(extension);
}

async function parseStudentInfoFromProject(projectPath: string, fallback: ReturnType<typeof parseStudentInfo>) {
  const files = await scanProject(projectPath, [".java"]);
  for (const file of files) {
    const sourceCode = await fs.readFile(file.absolutePath, "utf8");
    const parsed = parseStudentInfoFromSource(sourceCode, fallback);
    if (parsed.name !== fallback.name || parsed.studentId !== fallback.studentId) return parsed;
  }
  return fallback;
}

function parseStudentInfoFromSourceCandidates(current: ReturnType<typeof parseStudentInfo>, parsed: ReturnType<typeof parseStudentInfo>) {
  if (parsed.name === current.name && parsed.studentId === current.studentId) return current;
  return { ...current, name: parsed.name, studentId: parsed.studentId, identifier: parsed.identifier };
}

export const gradingService = new GradingService();
