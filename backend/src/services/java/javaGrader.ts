import { compareConsoleOutput } from "../../utils/normalizeOutput.js";
import { checkRequiredSourceMetadata, parseStudentInfo, parseStudentInfoFromSource } from "../../utils/studentInfoParser.js";
import type { Assignment } from "../../types/assignment.js";
import type { AssignmentGrader, ProblemGradeResult, RuleGradeResult, StudentGradeResult, TestStatus } from "../../types/grading.js";
import { findTargetJavaFile } from "./javaFileScanner.js";
import { parseJavaSource } from "./javaSourceParser.js";
import { compileJavaFile } from "./javaCompiler.js";
import { runJavaMain } from "./javaRunner.js";

export class JavaAssignmentGrader implements AssignmentGrader {
  async grade(projectPath: string, assignment: Assignment, fileName: string, answerProjectPath?: string): Promise<StudentGradeResult> {
    let student = parseStudentInfo(fileName);
    const problemResults: ProblemGradeResult[] = [];

    for (const problem of assignment.problems) {
      const target = await findTargetJavaFile(projectPath, problem.targetFilePattern);
      if (!target) {
        problemResults.push(emptyProblem(problem.id, problem.name, problem.points, "FILE_NOT_FOUND", `파일을 찾을 수 없습니다: ${problem.targetFilePattern}`));
        continue;
      }

      const source = await parseJavaSource(target.absolutePath);
      student = parseStudentInfoFromSource(source.sourceCode, student);
      const usesDeductionScoring = problem.scoringMode === "DEDUCT";
      const metadataResults = usesDeductionScoring ? [] : metadataRuleResults(source.sourceCode);
      if (!source.hasMainMethod || !source.fullyQualifiedClassName) {
        problemResults.push({
          problemId: problem.id,
          problemName: problem.name,
          targetFile: target.relativePath,
          sourceCode: source.sourceCode,
          status: "NO_MAIN_METHOD",
          score: 0,
          maxScore: problem.points,
          ruleResults: [
            ...metadataResults,
            { id: "main", label: "main 메서드", status: "NO_MAIN_METHOD", score: 0, maxScore: problem.points, reason: "실행 가능한 main 메서드를 찾지 못했습니다." }
          ]
        });
        continue;
      }

      const compile = await compileJavaFile(projectPath, target.relativePath, 10000);
      if (compile.status !== "OK" || compile.exitCode !== 0) {
        problemResults.push({
          problemId: problem.id,
          problemName: problem.name,
          targetFile: target.relativePath,
          sourceCode: source.sourceCode,
          status: compile.status === "TIMEOUT" ? "TIMEOUT" : "COMPILE_ERROR",
          score: 0,
          maxScore: problem.points,
          ruleResults: [
            ...metadataResults,
            { id: "compile", label: "컴파일", status: compile.status === "TIMEOUT" ? "TIMEOUT" : "COMPILE_ERROR", score: 0, maxScore: problem.points, actual: compile.stderr || compile.stdout, reason: "javac 컴파일에 실패했습니다." }
          ]
        });
        continue;
      }

      const answerTarget = answerProjectPath ? await findTargetJavaFile(answerProjectPath, problem.targetFilePattern) : undefined;
      const answerSource = answerTarget ? await parseJavaSource(answerTarget.absolutePath) : undefined;
      const answerCompile = answerProjectPath && answerTarget ? await compileJavaFile(answerProjectPath, answerTarget.relativePath, 10000) : undefined;

      const ruleResults: RuleGradeResult[] = [
        ...metadataResults,
        ...javaRequirementResults(source.sourceCode, source.hasMainMethod, javaRequirementsForProblem(problem), usesDeductionScoring)
      ];
      for (const testCase of testCasesForProblem(problem)) {
        let expectedOutput = testCase.expectedOutput;
        let answerError: string | undefined;

        if (answerProjectPath) {
          if (!answerTarget) {
            answerError = `답안 파일을 찾을 수 없습니다: ${problem.targetFilePattern}`;
          } else if (!answerSource?.hasMainMethod || !answerSource.fullyQualifiedClassName) {
            answerError = "답안 파일에서 실행 가능한 main 메서드를 찾지 못했습니다.";
          } else if (answerCompile?.status !== "OK" || answerCompile.exitCode !== 0) {
            answerError = answerCompile?.stderr || answerCompile?.stdout || "답안 파일 컴파일에 실패했습니다.";
          } else {
            const answerRun = await runJavaMain(answerProjectPath, answerSource.fullyQualifiedClassName, testCase.input, testCase.timeoutMs);
            if (answerRun.status !== "OK" || answerRun.exitCode !== 0) {
              answerError = answerRun.stderr || answerRun.stdout || "답안 파일 실행에 실패했습니다.";
            } else {
              expectedOutput = answerRun.stdout;
            }
          }
        }

        if (answerError) {
          ruleResults.push({
            id: testCase.id,
            label: `${problem.name} 답안 비교`,
            status: "SYSTEM_ERROR",
            score: 0,
            maxScore: testCase.score,
            input: testCase.input,
            actual: answerError,
            reason: answerError
          });
          continue;
        }

        const run = await runJavaMain(projectPath, source.fullyQualifiedClassName, testCase.input, testCase.timeoutMs);
        let status: TestStatus = "FAIL";
        let passed = false;
        if (run.status === "TIMEOUT") status = "TIMEOUT";
        else if (run.status === "OUTPUT_LIMIT") status = "OUTPUT_LIMIT";
        else if (run.status !== "OK") status = "SYSTEM_ERROR";
        else if (run.exitCode !== 0) status = "RUNTIME_ERROR";
        else {
          passed = compareConsoleOutput(run.stdout, expectedOutput, testCase.comparisonMode);
          status = passed ? "PASS" : "FAIL";
        }
        ruleResults.push({
          id: testCase.id,
          label: testCase.label || (answerProjectPath ? `${problem.name} 답안 비교` : `${problem.name} 테스트`),
          status,
          score: usesDeductionScoring ? (passed ? 0 : -testCase.score) : passed ? testCase.score : 0,
          maxScore: testCase.score,
          input: testCase.input,
          expected: expectedOutput,
          actual: run.stdout || run.stderr,
          reason: passed ? undefined : usesDeductionScoring ? `${statusReason(status)} ${testCase.score}점 감점됩니다.` : statusReason(status)
        });
      }

      const score = usesDeductionScoring
        ? Math.max(0, problem.points + ruleResults.reduce((sum, result) => sum + Math.min(0, result.score), 0))
        : ruleResults.reduce((sum, result) => sum + result.score, 0);
      problemResults.push({
        problemId: problem.id,
        problemName: problem.name,
        targetFile: target.relativePath,
        sourceCode: source.sourceCode,
        status: score === problem.points ? "PASS" : score > 0 ? "PARTIAL" : firstFailure(ruleResults),
        score,
        maxScore: problem.points,
        ruleResults
      });
    }

    const maxScore = assignment.problems.reduce((sum, problem) => sum + problem.points, 0);
    const autoScore = problemResults.reduce((sum, problem) => sum + problem.score, 0);
    const status = autoScore === maxScore ? "PASS" : autoScore > 0 ? "PARTIAL" : (problemResults[0]?.status ?? "FAIL");
    return { student, status, autoScore, manualAdjustment: 0, manualReason: "", finalScore: autoScore, maxScore, problemResults };
  }
}

type ProblemConfig = Assignment["problems"][number];

function testCasesForProblem(problem: ProblemConfig): ProblemConfig["javaTestCases"] {
  if (Array.isArray(problem.javaTestCases) && problem.javaTestCases.length > 0) return problem.javaTestCases;
  return [
    {
      id: `${problem.id}-answer-default`,
      input: "",
      expectedOutput: "",
      score: problem.scoringMode === "DEDUCT" ? problem.deductionPerFail ?? 0.5 : problem.points,
      comparisonMode: "NORMALIZED",
      timeoutMs: 3000
    }
  ];
}

function javaRequirementsForProblem(problem: ProblemConfig): NonNullable<ProblemConfig["javaRequirements"]> {
  if (Array.isArray(problem.javaRequirements) && problem.javaRequirements.length > 0) return problem.javaRequirements;
  return [
    { id: `${problem.id}-metadata`, type: "METADATA_FIELDS", label: "학기/과목/과제/소속/이름/학번 명시", score: problem.deductionPerFail ?? 0.5 },
    { id: `${problem.id}-main`, type: "MAIN_METHOD", label: "main 메서드 작성", score: problem.deductionPerFail ?? 0.5 }
  ];
}

function javaRequirementResults(
  sourceCode: string,
  hasMainMethod: boolean,
  requirements: NonNullable<ProblemConfig["javaRequirements"]>,
  usesDeductionScoring: boolean
): RuleGradeResult[] {
  return requirements.map((requirement) => {
    const { passed, actual, expected, reason } = checkJavaRequirement(sourceCode, hasMainMethod, requirement);
    return {
      id: requirement.id,
      label: requirement.label || requirement.type,
      group: "Java 요구사항",
      status: passed ? "PASS" : "FAIL",
      score: usesDeductionScoring ? (passed ? 0 : -requirement.score) : passed ? requirement.score : 0,
      maxScore: requirement.score,
      expected,
      actual,
      reason: passed ? undefined : usesDeductionScoring ? `${reason} ${requirement.score}점 감점됩니다.` : reason
    };
  });
}

function checkJavaRequirement(
  sourceCode: string,
  hasMainMethod: boolean,
  requirement: NonNullable<ProblemConfig["javaRequirements"]>[number]
): { passed: boolean; expected?: string; actual?: string; reason: string } {
  const expected = requirement.expected?.trim();
  if (requirement.type === "MAIN_METHOD") {
    return {
      passed: hasMainMethod,
      expected: "public static void main(...)",
      actual: hasMainMethod ? "main 메서드 있음" : "main 메서드 없음",
      reason: "main 메서드 조건을 만족하지 못했습니다."
    };
  }

  if (requirement.type === "METADATA_FIELDS") {
    const checks = checkRequiredSourceMetadata(sourceCode);
    const missing = checks.filter((check) => !check.found).map((check) => check.field);
    return {
      passed: missing.length === 0,
      expected: "학기, 과목, 과제, 소속, 이름, 학번",
      actual: checks.map((check) => `${check.field}: ${check.value ?? "없음"}`).join("\n"),
      reason: `소스 정보 누락: ${missing.join(", ")}`
    };
  }

  if (requirement.type === "USES_SCANNER") {
    const passed = /\bScanner\b/.test(sourceCode) && /new\s+Scanner\s*\(/.test(sourceCode);
    return {
      passed,
      expected: "Scanner 입력 사용",
      actual: sourceSnippet(sourceCode, "Scanner"),
      reason: "Scanner 입력 사용 조건을 만족하지 못했습니다."
    };
  }

  if (requirement.type === "SOURCE_MATCHES") {
    if (!expected) return { passed: false, expected, actual: "", reason: "기대 정규식이 비어 있습니다." };
    const passed = new RegExp(expected).test(sourceCode);
    return {
      passed,
      expected,
      actual: sourceCode.slice(0, 1200),
      reason: "코드 형식 조건을 만족하지 못했습니다."
    };
  }

  const tokens = splitExpectedTokens(expected);
  const passed = tokens.length > 0 && tokens.every((token) => sourceCode.includes(token));
  return {
    passed,
    expected,
    actual: tokens.map((token) => `${token}: ${sourceCode.includes(token) ? "있음" : "없음"}`).join("\n"),
    reason: "코드 포함 조건을 만족하지 못했습니다."
  };
}

function splitExpectedTokens(expected?: string): string[] {
  return String(expected ?? "")
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function sourceSnippet(sourceCode: string, token: string): string {
  const index = sourceCode.indexOf(token);
  if (index < 0) return `${token}: 없음`;
  return sourceCode.slice(Math.max(0, index - 80), Math.min(sourceCode.length, index + 160));
}

function metadataRuleResults(sourceCode: string): RuleGradeResult[] {
  const checks = checkRequiredSourceMetadata(sourceCode);
  const missing = checks.filter((check) => !check.found).map((check) => check.field);
  return [
    {
      id: "source-metadata",
      label: "소스 정보 명시",
      status: missing.length === 0 ? "PASS" : "FAIL",
      score: 0,
      maxScore: 0,
      expected: "학기, 과목, 과제, 소속, 이름, 학번",
      actual: checks.map((check) => `${check.field}: ${check.value ?? "없음"}`).join("\n"),
      reason: missing.length === 0 ? undefined : `누락: ${missing.join(", ")}`
    }
  ];
}

function emptyProblem(problemId: string, problemName: string, maxScore: number, status: TestStatus, reason: string): ProblemGradeResult {
  return {
    problemId,
    problemName,
    status,
    score: 0,
    maxScore,
    ruleResults: [{ id: status, label: problemName, status, score: 0, maxScore, reason }]
  };
}

function firstFailure(results: RuleGradeResult[]): TestStatus {
  return results.find((result) => result.status !== "PASS")?.status ?? "FAIL";
}

function statusReason(status: TestStatus): string {
  const messages: Record<TestStatus, string> = {
    PASS: "성공",
    FAIL: "예상 출력과 실제 출력이 다릅니다.",
    FILE_NOT_FOUND: "대상 파일을 찾지 못했습니다.",
    NO_MAIN_METHOD: "main 메서드가 없습니다.",
    COMPILE_ERROR: "컴파일 오류입니다.",
    RUNTIME_ERROR: "실행 중 오류가 발생했습니다.",
    TIMEOUT: "제한 시간을 초과했습니다.",
    OUTPUT_LIMIT: "출력 제한을 초과했습니다.",
    SYSTEM_ERROR: "시스템 오류가 발생했습니다."
  };
  return messages[status];
}
