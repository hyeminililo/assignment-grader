import type { GradeJobProgress } from "../types/grading";

interface Props {
  progress?: GradeJobProgress;
}

export function GradingProgress({ progress }: Props) {
  if (!progress) return null;
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">채점 진행률</h3>
        <span className="text-sm">{progress.completed} / {progress.total}</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-gray-200">
        <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 text-sm text-gray-600">
        상태: {progress.status}
        {progress.current ? ` · 현재: ${progress.current.studentId} ${progress.current.name}` : ""}
      </div>
    </section>
  );
}
