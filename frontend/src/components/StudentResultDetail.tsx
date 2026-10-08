import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { StudentGradeResult } from "../types/grading";
import { StatusBadge } from "./ResultTable";

interface Props {
  result?: StudentGradeResult;
  onSaveManual: (studentId: string, adjustment: number, reason: string) => void;
}

export function StudentResultDetail({ result, onSaveManual }: Props) {
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setAdjustment(result?.manualAdjustment ?? 0);
    setReason(result?.manualReason ?? "");
  }, [result?.student.studentId, result?.manualAdjustment, result?.manualReason]);
  if (!result) return <section className="card p-4 text-sm text-gray-600">학생을 선택하면 상세 결과가 표시됩니다.</section>;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{result.student.name}</h3>
            <div className="font-mono text-sm text-gray-600">{result.student.studentId}</div>
          </div>
          <StatusBadge status={result.status} />
        </div>
        <div className="mt-3 text-2xl font-semibold">{result.finalScore} / {result.maxScore}</div>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded border border-line p-3">
          <h4 className="mb-2 text-sm font-semibold">수동 점수 수정</h4>
          <div className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
            <input type="number" value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} />
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="수정 사유" />
            <button type="button" className="primary-button" onClick={() => onSaveManual(result.student.studentId, adjustment, reason)}>
              <Save size={16} /> 저장
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">현재 조정: {result.manualAdjustment}, 사유: {result.manualReason || "-"}</p>
        </div>
        {result.problemResults.map((problem) => (
          <div className="rounded border border-line" key={problem.problemId}>
            <div className="flex items-center justify-between border-b border-line p-3">
              <strong>{problem.problemName}</strong>
              <span>{problem.score} / {problem.maxScore}</span>
            </div>
            <div className="space-y-3 p-3">
              {problem.ruleResults.map((rule) => (
                <div className="rounded bg-panel p-3" key={rule.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{rule.label}</span>
                    <span>{rule.status} {formatRuleScore(rule.score)}</span>
                  </div>
                  {rule.reason && <p className="text-sm text-red-700">{rule.reason}</p>}
                  {rule.input && <pre className="mt-2 overflow-auto rounded bg-white p-2 text-xs">Input:{`\n${rule.input}`}</pre>}
                  {rule.expected && <pre className="mt-2 overflow-auto rounded bg-white p-2 text-xs">Expected:{`\n${rule.expected}`}</pre>}
                  {rule.actual && <pre className="mt-2 max-h-44 overflow-auto rounded bg-white p-2 text-xs">Actual:{`\n${rule.actual}`}</pre>}
                </div>
              ))}
              {problem.sourceCode && <details><summary className="cursor-pointer text-sm font-semibold">소스 코드</summary><pre className="mt-2 max-h-80 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{problem.sourceCode}</pre></details>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatRuleScore(score: number): string {
  if (score < 0) return `감점 ${Math.abs(score)}점`;
  return `+${score}`;
}
