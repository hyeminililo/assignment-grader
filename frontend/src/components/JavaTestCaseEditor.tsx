import { Keyboard, Plus, Trash2 } from "lucide-react";
import type { JavaRequirement, JavaRequirementType, JavaTestCase } from "../types/assignment";

interface Props {
  testCases: JavaTestCase[];
  requirements: JavaRequirement[];
  onChange: (testCases: JavaTestCase[]) => void;
  onRequirementsChange: (requirements: JavaRequirement[]) => void;
}

const modes = ["EXACT", "NORMALIZED", "CONTAINS"] as const;
const requirementTypes: JavaRequirementType[] = ["SOURCE_CONTAINS", "SOURCE_MATCHES", "USES_SCANNER", "MAIN_METHOD", "METADATA_FIELDS"];
const requirementTypeLabels: Record<JavaRequirementType, string> = {
  SOURCE_CONTAINS: "코드 포함 확인",
  SOURCE_MATCHES: "코드 형식 확인",
  USES_SCANNER: "Scanner 사용 확인",
  MAIN_METHOD: "main 메서드 확인",
  METADATA_FIELDS: "소스 정보 명시 확인"
};
const snackShopCase: Omit<JavaTestCase, "id"> = {
  label: "분식점 예시 입력",
  input: "3\n4\n2",
  expectedOutput: "전체 금액은 16000원입니다.",
  score: 0.5,
  comparisonMode: "CONTAINS",
  timeoutMs: 3000
};

export function JavaTestCaseEditor({ testCases, requirements, onChange, onRequirementsChange }: Props) {
  const update = (id: string, patch: Partial<JavaTestCase>) => onChange(testCases.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const updateRequirement = (id: string, patch: Partial<JavaRequirement>) => onRequirementsChange(requirements.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const addSnackShopCase = () => onChange([...testCases, { id: crypto.randomUUID(), ...snackShopCase }]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Java 테스트케이스</h4>
        <div className="flex gap-2">
          <button type="button" className="quiet-button" onClick={addSnackShopCase}>
            <Keyboard size={16} /> Scanner 예시
          </button>
          <button
            type="button"
            className="quiet-button"
            onClick={() =>
              onChange([
                ...testCases,
                { id: crypto.randomUUID(), label: "새 테스트", input: "", expectedOutput: "", score: 0.5, comparisonMode: "CONTAINS", timeoutMs: 3000 }
              ])
            }
          >
            <Plus size={16} /> 추가
          </button>
        </div>
      </div>
      {testCases.map((testCase, index) => (
        <div className="rounded border border-line p-3" key={testCase.id}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">TC {index + 1}</span>
            <button type="button" className="quiet-button px-2" onClick={() => onChange(testCases.filter((item) => item.id !== testCase.id))}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium md:col-span-2">테스트 이름<input value={testCase.label ?? ""} onChange={(event) => update(testCase.id, { label: event.target.value })} /></label>
            <label className="text-xs font-medium">입력값(stdin)<textarea rows={6} placeholder={"3\n4\n2"} value={testCase.input} onChange={(event) => update(testCase.id, { input: event.target.value })} /></label>
            <label className="text-xs font-medium">예상 출력<textarea rows={6} placeholder="전체 금액은 16000원입니다." value={testCase.expectedOutput} onChange={(event) => update(testCase.id, { expectedOutput: event.target.value })} /></label>
            <label className="text-xs font-medium">실패 시 감점<input type="number" step={0.5} value={testCase.score} onChange={(event) => update(testCase.id, { score: Number(event.target.value) })} /></label>
            <label className="text-xs font-medium">제한 시간(ms)<input type="number" value={testCase.timeoutMs} onChange={(event) => update(testCase.id, { timeoutMs: Number(event.target.value) })} /></label>
            <label className="text-xs font-medium md:col-span-2">
              출력 비교 방식
              <select value={testCase.comparisonMode} onChange={(event) => update(testCase.id, { comparisonMode: event.target.value as JavaTestCase["comparisonMode"] })}>
                {modes.map((mode) => <option key={mode}>{mode}</option>)}
              </select>
            </label>
          </div>
        </div>
      ))}
      <div className="mt-5 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Java 요구사항</h4>
        <button
          type="button"
          className="quiet-button"
          onClick={() =>
            onRequirementsChange([
              ...requirements,
              { id: crypto.randomUUID(), type: "SOURCE_CONTAINS", label: "코드 포함 확인", expected: "Scanner", score: 0.5 }
            ])
          }
        >
          <Plus size={16} /> 요구사항 추가
        </button>
      </div>
      {requirements.map((requirement, index) => (
        <div className="rounded border border-line p-3" key={requirement.id}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">요구사항 {index + 1}</span>
            <button type="button" className="quiet-button px-2" onClick={() => onRequirementsChange(requirements.filter((item) => item.id !== requirement.id))}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium">요구사항 이름<input value={requirement.label} onChange={(event) => updateRequirement(requirement.id, { label: event.target.value })} /></label>
            <label className="text-xs font-medium">
              검사 방식
              <select value={requirement.type} onChange={(event) => updateRequirement(requirement.id, { type: event.target.value as JavaRequirementType })}>
                {requirementTypes.map((type) => <option value={type} key={type}>{requirementTypeLabels[type]}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium">실패 시 감점<input type="number" step={0.5} value={requirement.score} onChange={(event) => updateRequirement(requirement.id, { score: Number(event.target.value) })} /></label>
            <label className="text-xs font-medium">기대값<input value={requirement.expected ?? ""} onChange={(event) => updateRequirement(requirement.id, { expected: event.target.value })} placeholder="예: Scanner, nextInt, /, %" /></label>
          </div>
        </div>
      ))}
    </div>
  );
}
