import type { StudentGradeResult, StudentStatus } from "../types/grading";

interface Props {
  results: StudentGradeResult[];
  selectedStudentId?: string;
  onSelect: (result: StudentGradeResult) => void;
}

const statusColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  FAIL: "bg-red-100 text-red-800",
  COMPILE_ERROR: "bg-red-100 text-red-800",
  SYSTEM_ERROR: "bg-red-100 text-red-800"
};

export function ResultTable({ results, selectedStudentId, onSelect }: Props) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line p-4">
        <h3 className="font-semibold">결과</h3>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-panel text-left">
            <tr>
              <th className="p-3">학번</th>
              <th className="p-3">이름</th>
              <th className="p-3">점수</th>
              <th className="p-3">문제 성공</th>
              <th className="p-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const passed = result.problemResults.filter((problem) => problem.status === "PASS").length;
              return (
                <tr key={`${result.student.identifier}:${result.student.fileName}:${index}`} className={`cursor-pointer border-t border-line hover:bg-panel ${selectedStudentId === result.student.studentId ? "bg-blue-50" : ""}`} onClick={() => onSelect(result)}>
                  <td className="p-3 font-mono">{result.student.studentId}</td>
                  <td className="p-3">{result.student.name}</td>
                  <td className="p-3 font-semibold">{result.finalScore}/{result.maxScore}</td>
                  <td className="p-3">{passed}/{result.problemResults.length}</td>
                  <td className="p-3"><StatusBadge status={result.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: StudentStatus }) {
  return <span className={`badge ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>{status}</span>;
}
