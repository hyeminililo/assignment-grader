import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { gradingService } from "../services/grading/gradingService.js";
import { repairUploadedFileName } from "../utils/fileNameEncoding.js";
import type { Assignment } from "../types/assignment.js";

const uploadDir = path.resolve("uploads");
await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    files: 120,
    fileSize: 40 * 1024 * 1024
  }
});

const router = Router();

router.post("/start", upload.fields([{ name: "files", maxCount: 120 }, { name: "answerFile", maxCount: 1 }]), (req, res) => {
  const uploaded = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
  const files = uploaded.files ?? [];
  const answerFile = uploaded.answerFile?.[0];
  if (!req.body.assignment) return res.status(400).json({ message: "assignment JSON is required" });
  const assignment = JSON.parse(req.body.assignment) as Assignment;
  const concurrency = Number(req.body.concurrency ?? 2);
  const job = gradingService.startJob(
    assignment,
    files.map((file) => ({ path: file.path, originalname: repairUploadedFileName(file.originalname) })),
    answerFile ? { path: answerFile.path, originalname: repairUploadedFileName(answerFile.originalname) } : undefined,
    concurrency
  );
  res.status(202).json(job);
});

router.get("/jobs/:jobId", (req, res) => {
  const job = gradingService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json(job);
});

router.get("/jobs/:jobId/events", (req, res) => {
  const job = gradingService.getJob(req.params.jobId);
  const emitter = gradingService.getEmitter(req.params.jobId);
  if (!job || !emitter) return res.status(404).end();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify(job.progress)}\n\n`);
  const listener = (progress: unknown) => res.write(`data: ${JSON.stringify(progress)}\n\n`);
  emitter.on("progress", listener);
  req.on("close", () => emitter.off("progress", listener));
});

router.patch("/jobs/:jobId/manual-adjustments", (req, res) => {
  const { studentId, adjustment, reason } = req.body;
  const result = gradingService.updateManualAdjustment(req.params.jobId, studentId, Number(adjustment), String(reason ?? ""));
  if (!result) return res.status(404).json({ message: "Student result not found" });
  res.json(result);
});

router.get("/jobs/:jobId/csv", (req, res) => {
  const csv = gradingService.toCsv(req.params.jobId);
  if (!csv) return res.status(404).json({ message: "Job not found" });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="grading-${req.params.jobId}.csv"`);
  res.send(`\uFEFF${csv}`);
});

export default router;
