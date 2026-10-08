import type { AssignmentType } from "../types/assignment";

interface Props {
  value: AssignmentType;
  onChange: (type: AssignmentType) => void;
}

export function AssignmentTypeSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["JAVA", "WEB"] as AssignmentType[]).map((type) => (
        <button
          key={type}
          className={value === type ? "primary-button" : "quiet-button"}
          onClick={() => onChange(type)}
          type="button"
        >
          {type === "JAVA" ? "Java 프로그래밍" : "백엔드 Web"}
        </button>
      ))}
    </div>
  );
}
