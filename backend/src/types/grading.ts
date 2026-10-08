import type { Assignment } from "./assignment.js";

export type TestStatus =
  | "PASS"
  | "FAIL"
  | "FILE_NOT_FOUND"
  | "NO_MAIN_METHOD"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "OUTPUT_LIMIT"
  | "SYSTEM_ERROR";

export type StudentStatus = "PASS" | "PARTIAL" | "FAIL" | TestStatus;

export interface StudentInfo {
  assignment?: string;
  name: string;
  studentId: string;
  identifier: string;
  fileName: string;
}

export interface RuleGradeResult {
  id: string;
  label: string;
  group?: string;
  status: TestStatus;
  score: number;
  maxScore: number;
  expected?: string;
  actual?: string;
  input?: string;
  reason?: string;
}

export interface ProblemGradeResult {
  problemId: string;
  problemName: string;
  status: StudentStatus;
  score: number;
  maxScore: number;
  targetFile?: string;
  sourceCode?: string;
  ruleResults: RuleGradeResult[];
}

export interface StudentGradeResult {
  student: StudentInfo;
  status: StudentStatus;
  autoScore: number;
  manualAdjustment: number;
  manualReason: string;
  finalScore: number;
  maxScore: number;
  problemResults: ProblemGradeResult[];
}

export interface GradeJobProgress {
  total: number;
  completed: number;
  current?: StudentInfo;
  status: "queued" | "running" | "done" | "failed";
  message?: string;
}

export interface GradeJob {
  id: string;
  assignment: Assignment;
  progress: GradeJobProgress;
  results: StudentGradeResult[];
  createdAt: string;
}

export interface AssignmentGrader {
  grade(projectPath: string, assignment: Assignment, fileName: string, answerProjectPath?: string): Promise<StudentGradeResult>;
}
