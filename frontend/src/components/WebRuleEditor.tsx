import { Plus, Trash2 } from "lucide-react";
import type { WebRule, WebRuleType } from "../types/assignment";

interface Props {
  rules: WebRule[];
  onChange: (rules: WebRule[]) => void;
}

const ruleTypes: WebRuleType[] = ["ELEMENT_EXISTS", "ELEMENT_VISIBLE", "TEXT_CONTAINS", "TITLE_CONTAINS", "TITLE_MATCHES", "SOURCE_CONTAINS", "ATTRIBUTE_EQUALS", "CSS_RULE_EXISTS", "HOVER_STYLE", "PAGE_EXECUTION", "JS_EXECUTION", "PROMPT_FLOW"];

const ruleTypeLabels: Record<WebRuleType, string> = {
  ELEMENT_EXISTS: "요소 존재 확인",
  ELEMENT_VISIBLE: "요소 표시 확인",
  TEXT_CONTAINS: "화면 텍스트 확인",
  TITLE_CONTAINS: "title 포함 확인",
  TITLE_MATCHES: "title 형식 확인",
  SOURCE_CONTAINS: "코드 포함 확인",
  ATTRIBUTE_EQUALS: "속성값 확인",
  CSS_RULE_EXISTS: "CSS 규칙 확인",
  HOVER_STYLE: "hover 코드 확인",
  PAGE_EXECUTION: "페이지 실행 확인",
  JS_EXECUTION: "자바스크립트 실행 확인",
  PROMPT_FLOW: "prompt 입력 흐름 확인"
};

export function WebRuleEditor({ rules, onChange }: Props) {
  const update = (id: string, patch: Partial<WebRule>) => onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  const groupedRules = groupRules(rules);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">세부 채점 규칙</h4>
        <button type="button" className="quiet-button" onClick={() => onChange([...rules, { id: crypto.randomUUID(), type: "ELEMENT_EXISTS", label: "HTML 요소 존재", group: "직접 추가", selector: "table", score: 10 }])}>
          <Plus size={16} /> 추가
        </button>
      </div>
      {groupedRules.map(({ group, items }) => (
        <details className="rounded border border-line bg-white p-3" key={group} open>
          <summary className="cursor-pointer text-sm font-semibold">{group} ({items.length}개)</summary>
          <div className="mt-3 space-y-3">
            {items.map((rule, index) => (
              <div className="rounded border border-line p-3" key={rule.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">세부 조건 {index + 1}</span>
                  <button type="button" className="quiet-button px-2" onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-medium">문단<input value={rule.group ?? ""} onChange={(event) => update(rule.id, { group: event.target.value })} /></label>
                  <label className="text-xs font-medium">규칙 이름<input value={rule.label} onChange={(event) => update(rule.id, { label: event.target.value })} /></label>
                  <label className="text-xs font-medium">
                    검사 방식
                    <select value={rule.type} onChange={(event) => update(rule.id, { type: event.target.value as WebRuleType })}>
                      {ruleTypes.map((type) => <option value={type} key={type}>{ruleTypeLabels[type]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">배점/감점<input type="number" step={0.5} value={rule.score} onChange={(event) => update(rule.id, { score: Number(event.target.value) })} /></label>
                  <label className="text-xs font-medium">대상 선택자<input value={rule.selector ?? ""} onChange={(event) => update(rule.id, { selector: event.target.value })} /></label>
                  <label className="text-xs font-medium">속성 이름<input value={rule.attribute ?? ""} onChange={(event) => update(rule.id, { attribute: event.target.value })} /></label>
                  <label className="text-xs font-medium md:col-span-3">기대값<input value={rule.expected ?? ""} onChange={(event) => update(rule.id, { expected: event.target.value })} /></label>
                  <label className="text-xs font-medium md:col-span-3">prompt 입력값<textarea rows={3} value={(rule.promptInputs ?? []).join("\n")} onChange={(event) => update(rule.id, { promptInputs: event.target.value.split("\n") })} /></label>
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function groupRules(rules: WebRule[]): Array<{ group: string; items: WebRule[] }> {
  const groups = new Map<string, WebRule[]>();
  for (const rule of rules) {
    const group = rule.group?.trim() || "기타 조건";
    groups.set(group, [...(groups.get(group) ?? []), rule]);
  }
  return Array.from(groups, ([group, items]) => ({ group, items }));
}
