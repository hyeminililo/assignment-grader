import fs from "node:fs/promises";
import { parseStudentInfo, parseStudentInfoFromHtmlTitle } from "../../utils/studentInfoParser.js";
import type { Assignment } from "../../types/assignment.js";
import type { AssignmentGrader, ProblemGradeResult, RuleGradeResult, StudentGradeResult } from "../../types/grading.js";
import { matchesTarget, scanProject } from "../archive/projectScanner.js";
import { attributeEquals, elementExists, loadHtml, textContains, titleContains, titleMatches } from "./htmlAnalyzer.js";
import { collectInlineStyles, cssRuleExists } from "./cssAnalyzer.js";
import { runBrowserCheck } from "./browserRunner.js";

export class WebAssignmentGrader implements AssignmentGrader {
  async grade(projectPath: string, assignment: Assignment, fileName: string, answerProjectPath?: string): Promise<StudentGradeResult> {
    let student = parseStudentInfo(fileName);
    const files = await scanProject(projectPath, [".html", ".css", ".js", ".java", ".jsp", ".xml"]);
    const problemResults: ProblemGradeResult[] = [];

    for (const problem of assignment.problems) {
      const target = files.find((file) => matchesTarget(file, problem.targetFilePattern));
      if (!target) {
        const htmlFiles = files.filter((file) => file.extension === ".html" || file.extension === ".htm");
        problemResults.push({
          problemId: problem.id,
          problemName: problem.name,
          status: "FILE_NOT_FOUND",
          score: 0,
          maxScore: problem.points,
          ruleResults: [
            {
              id: "file",
              label: "파일 이름 확인",
              status: "FILE_NOT_FOUND",
              score: 0,
              maxScore: problem.points,
              expected: problem.targetFilePattern,
              actual: htmlFiles.map((file) => file.relativePath).join("\n"),
              reason: `필수 파일 이름이 다릅니다. ${problem.targetFilePattern} 파일을 찾을 수 없어 이 문제는 0점 처리됩니다.`
            }
          ]
        });
        continue;
      }

      const sourceCode = await fs.readFile(target.absolutePath, "utf8");
      if (problem.webRules.length === 0) {
        console.warn("[web-rule] no rules configured", { fileName, problem: problem.name, targetFile: target.relativePath });
        problemResults.push({
          problemId: problem.id,
          problemName: problem.name,
          targetFile: target.relativePath,
          sourceCode,
          status: "SYSTEM_ERROR",
          score: 0,
          maxScore: problem.points,
          ruleResults: [
            {
              id: "no-rules",
              label: "채점 규칙 확인",
              status: "SYSTEM_ERROR",
              score: 0,
              maxScore: problem.points,
              reason: "고급 규칙 설정이 비어 있습니다. 문제 내용을 붙여넣고 '규칙 생성'을 눌러 채점 규칙을 만든 뒤 다시 채점하세요."
            }
          ]
        });
        continue;
      }

      const { html, $ } = await loadHtml(target.absolutePath);
      student = parseStudentInfoFromHtmlTitle($("title").text(), student);
      const cssFiles = files.filter((file) => file.extension === ".css");
      const externalCss = await Promise.all(cssFiles.map((file) => fs.readFile(file.absolutePath, "utf8").catch(() => "")));
      const cssSource = [collectInlineStyles($), ...externalCss].join("\n");
      const ruleResults: RuleGradeResult[] = [
        {
          id: "file-name",
          label: "파일 이름 확인",
          status: "PASS",
          score: 0,
          maxScore: 0,
          expected: problem.targetFilePattern,
          actual: target.relativePath
        }
      ];
      const usesDeductionScoring = problem.scoringMode === "DEDUCT";
      const deductionPerFail = problem.deductionPerFail ?? 0.5;

      for (const rule of problem.webRules) {
        let passed = false;
        let actual = "";
        let reason = "";
        try {
          console.info("[web-rule] start", { fileName, problem: problem.name, rule: rule.label, type: rule.type, selector: rule.selector, expected: rule.expected });
          if (rule.type === "ELEMENT_EXISTS") passed = elementExists($, rule.selector);
          if (rule.type === "TEXT_CONTAINS") passed = textContains($, rule.expected);
          if (rule.type === "TITLE_CONTAINS") passed = titleContains($, rule.expected);
          if (rule.type === "TITLE_MATCHES") passed = titleMatches($, rule.expected);
          if (rule.type === "SOURCE_CONTAINS") passed = sourceContains(sourceCode, rule.expected);
          if (rule.type === "HOVER_STYLE") passed = Boolean(sourceCode.includes(":hover") && hoverStyleTokens(rule.expected).every((token) => sourceCode.includes(token)));
          if (rule.type === "ATTRIBUTE_EQUALS") passed = attributeEquals($, rule.selector, rule.attribute, rule.expected);
          if (rule.type === "CSS_RULE_EXISTS") passed = cssRuleExists(cssSource, rule.selector, rule.expected);
          if (rule.type === "ELEMENT_VISIBLE" || rule.type === "PAGE_EXECUTION" || rule.type === "JS_EXECUTION" || rule.type === "PROMPT_FLOW") {
            const browser = await runBrowserCheck({
              htmlFile: target.absolutePath,
              selector: rule.selector,
              expected: rule.expected,
              mode: "default",
              promptInputs: rule.promptInputs,
              actions: rule.actions
            });
            passed = browser.passed;
            actual = browser.text;
            reason = browser.errors.join("\n");
          }
          if (!actual) actual = html.slice(0, 4000);
          console.info("[web-rule] done", { fileName, problem: problem.name, rule: rule.label, type: rule.type, passed, reason });
        } catch (error) {
          reason = error instanceof Error ? error.message : "Web rule 실행 중 오류";
          console.error("[web-rule-error]", { fileName, problem: problem.name, rule: rule.label, type: rule.type, error });
        }
        ruleResults.push({
          id: rule.id,
          label: rule.label || rule.type,
          group: rule.group,
          status: passed ? "PASS" : "FAIL",
          score: usesDeductionScoring ? (passed ? 0 : -deductionPerFail) : passed ? rule.score : 0,
          maxScore: usesDeductionScoring ? deductionPerFail : rule.score,
          expected: rule.expected,
          actual,
          reason: passed ? undefined : reason || (usesDeductionScoring ? `규칙 조건을 만족하지 못해 ${deductionPerFail}점 감점됩니다.` : "규칙 조건을 만족하지 못했습니다.")
        });
      }

      const failedCount = ruleResults.filter((result) => result.status !== "PASS").length;
      const score = usesDeductionScoring
        ? Math.max(0, problem.points - failedCount * deductionPerFail)
        : ruleResults.reduce((sum, result) => sum + result.score, 0);
      problemResults.push({
        problemId: problem.id,
        problemName: problem.name,
        targetFile: target.relativePath,
        sourceCode,
        status: score === problem.points ? "PASS" : score > 0 ? "PARTIAL" : "FAIL",
        score,
        maxScore: problem.points,
        ruleResults
      });
    }

    const maxScore = assignment.problems.reduce((sum, problem) => sum + problem.points, 0);
    const autoScore = problemResults.reduce((sum, problem) => sum + problem.score, 0);
    return {
      student,
      status: autoScore === maxScore ? "PASS" : autoScore > 0 ? "PARTIAL" : "FAIL",
      autoScore,
      manualAdjustment: 0,
      manualReason: "",
      finalScore: autoScore,
      maxScore,
      problemResults
    };
  }
}

function sourceContains(sourceCode: string, expected?: string): boolean {
  if (!expected) return false;
  if (sourceCode.includes(expected)) return true;
  const normalizedSource = normalizeSourceText(sourceCode);
  const normalizedExpected = normalizeSourceText(expected);
  return normalizedSource.includes(normalizedExpected);
}

function normalizeSourceText(value: string): string {
  return value.replace(/\s+/g, "").replace(/;/g, "");
}

function hoverStyleTokens(expected?: string): string[] {
  return String(expected ?? "")
    .split(";")
    .map((item) => item.split(":").at(1)?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => !["white", "bold", "italic"].includes(value));
}
