import { useState } from "react";
import { HelpCircle, Plus, Trash2, X } from "lucide-react";
import type { AssignmentType, Problem } from "../types/assignment";
import { JavaTestCaseEditor } from "./JavaTestCaseEditor";
import { WebRuleEditor } from "./WebRuleEditor";

interface Props {
  type: AssignmentType;
  problems: Problem[];
  onChange: (problems: Problem[]) => void;
}

export function ProblemEditor({ type, problems, onChange }: Props) {
  const [showRuleHelp, setShowRuleHelp] = useState(false);
  const update = (id: string, patch: Partial<Problem>) => onChange(problems.map((problem) => (problem.id === id ? { ...problem, ...patch } : problem)));
  return (
    <section className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">세부 문제 설정</h3>
        <button type="button" className="quiet-button" onClick={() => onChange([...problems, newProblem(type)])}>
          <Plus size={16} /> 문제 추가
        </button>
      </div>
      <div className="space-y-4">
        {problems.map((problem, index) => (
          <div className="rounded border border-line p-4" key={problem.id}>
            <div className="mb-3 flex items-center justify-between">
              <strong>문제 {index + 1}</strong>
              <button type="button" className="quiet-button px-2" onClick={() => onChange(problems.filter((item) => item.id !== problem.id))}><Trash2 size={16} /></button>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <label className="text-xs font-medium">문제명<input value={problem.name} onChange={(event) => update(problem.id, { name: event.target.value })} /></label>
              <label className="text-xs font-medium">대상 파일 패턴<input value={problem.targetFilePattern} onChange={(event) => update(problem.id, { targetFilePattern: event.target.value })} /></label>
              <label className="text-xs font-medium">배점<input type="number" value={problem.points} onChange={(event) => update(problem.id, { points: Number(event.target.value) })} /></label>
              <label className="text-xs font-medium">
                실패당 감점
                <input type="number" step={0.5} value={problem.deductionPerFail ?? 0.5} onChange={(event) => update(problem.id, { deductionPerFail: Number(event.target.value), scoringMode: "DEDUCT" })} />
              </label>
            </div>
            {type === "WEB" && (
              <label className="mb-4 block text-xs font-medium">
                채점 기준 메모
                <textarea
                  rows={4}
                  value={problem.gradingGuide ?? ""}
                  onChange={(event) => update(problem.id, { gradingGuide: event.target.value })}
                  placeholder="예: 정답 파일과 완전히 같을 필요는 없고, 메뉴 표가 존재하며 가격 텍스트와 강조 스타일이 보이면 인정"
                />
              </label>
            )}
            {type === "JAVA" ? (
              <JavaTestCaseEditor
                testCases={problem.javaTestCases ?? []}
                requirements={problem.javaRequirements ?? []}
                onChange={(javaTestCases) => update(problem.id, { javaTestCases })}
                onRequirementsChange={(javaRequirements) => update(problem.id, { javaRequirements })}
              />
            ) : (
              <details className="rounded border border-line bg-panel p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  <span className="inline-flex items-center gap-2">
                    고급 규칙 설정 ({problem.webRules.length}개)
                    <button
                      type="button"
                      className="quiet-button px-1 py-1"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowRuleHelp(true);
                      }}
                      aria-label="검사 방식 도움말"
                    >
                      <HelpCircle size={15} />
                    </button>
                  </span>
                </summary>
                <div className="mt-3">
                  <WebRuleEditor rules={problem.webRules} onChange={(webRules) => update(problem.id, { webRules })} />
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
      {showRuleHelp && <RuleHelpDialog onClose={() => setShowRuleHelp(false)} />}
    </section>
  );
}

function RuleHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">검사 방식 도움말</h3>
          <button type="button" className="quiet-button px-2" onClick={onClose} aria-label="닫기">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 text-sm text-gray-700">
          <p><strong>파일 이름 확인</strong>: 검사 방식에서 고르지 않습니다. `대상 파일 패턴`에 `be1-1.html`처럼 적으면 ZIP 안에서 자동 확인합니다. 못 찾으면 해당 문제는 0점입니다.</p>
          <p><strong>문단</strong>: 과제 문장 묶음입니다. 예를 들어 `테이블 작성 조건`, `비정형 병합 조건`, `가상 클래스 조건`처럼 나누어 두면 규칙을 찾기 쉽습니다.</p>
          <p><strong>title 형식 확인</strong>: `be1-1_이름_학번`처럼 title 태그 형식을 확인할 때 씁니다.</p>
          <p><strong>요소 존재 확인</strong>: `table`, `caption`, `button` 같은 HTML 태그가 있는지 봅니다.</p>
          <p><strong>화면 텍스트 확인</strong>: 화면에 특정 문구가 나오는지 봅니다.</p>
          <p><strong>CSS 규칙 확인</strong>: `table`에 `border-collapse: collapse` 같은 CSS가 있는지 봅니다.</p>
          <p><strong>속성값 확인</strong>: `rowspan=2`, `colspan=5`처럼 HTML 속성을 확인합니다.</p>
          <p><strong>코드 포함 확인</strong>: `:hover`, `plum`, `prompt`, `15000`처럼 코드에 특정 단어가 있는지 봅니다.</p>
          <p><strong>prompt 입력 흐름 확인</strong>: prompt에 값을 넣고 실제 화면 출력 결과를 확인합니다.</p>
          <p><strong>페이지 실행 확인</strong>: 브라우저에서 페이지가 오류 없이 열리는지만 확인합니다.</p>
        </div>
      </div>
    </div>
  );
}

function newProblem(type: AssignmentType): Problem {
  const id = crypto.randomUUID();
  return {
    id,
    name: type === "JAVA" ? "분식점 가격 계산" : "BE1-1",
    targetFilePattern: type === "JAVA" ? "Snack.java" : "be1-1.html",
    points: 5,
    scoringMode: "DEDUCT",
    deductionPerFail: 0.5,
    gradingGuide: type === "WEB" ? "정답 파일과 완전히 같을 필요는 없고, 핵심 요소와 텍스트가 조건을 만족하면 인정합니다." : "",
    javaTestCases: type === "JAVA" ? [{ id: crypto.randomUUID(), label: "분식점 예시 입력", input: "3\n4\n2", expectedOutput: "전체 금액은 16000원입니다.", score: 0.5, comparisonMode: "CONTAINS", timeoutMs: 3000 }] : [],
    javaRequirements: type === "JAVA" ? defaultJavaRequirements() : [],
    webRules: type === "WEB" ? [{ id: crypto.randomUUID(), type: "ELEMENT_EXISTS", label: "table 존재", selector: "table", score: 0.5 }] : []
  };
}

function defaultJavaRequirements() {
  return [
    { id: crypto.randomUUID(), type: "METADATA_FIELDS" as const, label: "학기/과목/과제/소속/이름/학번 명시", score: 0.5 },
    { id: crypto.randomUUID(), type: "MAIN_METHOD" as const, label: "main 메서드 작성", score: 0.5 },
    { id: crypto.randomUUID(), type: "USES_SCANNER" as const, label: "Scanner 입력 사용", score: 0.5 }
  ];
}
