import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Assignment } from "../types/assignment.js";

const router = Router();
const assignments = new Map<string, Assignment>();

router.post("/", (req, res) => {
  const assignment: Assignment = { ...req.body, id: req.body.id || randomUUID() };
  assignments.set(assignment.id, assignment);
  res.status(201).json(assignment);
});

router.get("/:id", (req, res) => {
  const assignment = assignments.get(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  res.json(assignment);
});

export default router;
