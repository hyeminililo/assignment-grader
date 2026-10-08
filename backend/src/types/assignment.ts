export type AssignmentType = "JAVA" | "WEB";
export type ComparisonMode = "EXACT" | "NORMALIZED" | "CONTAINS";

export interface JavaTestCase {
  id: string;
  label?: string;
  input: string;
  expectedOutput: string;
  score: number;
  comparisonMode: ComparisonMode;
  timeoutMs: number;
}

export type JavaRequirementType = "SOURCE_CONTAINS" | "SOURCE_MATCHES" | "USES_SCANNER" | "MAIN_METHOD" | "METADATA_FIELDS";

export interface JavaRequirement {
  id: string;
  type: JavaRequirementType;
  label: string;
  expected?: string;
  score: number;
}

export type WebRuleType =
  | "ELEMENT_EXISTS"
  | "ELEMENT_VISIBLE"
  | "TEXT_CONTAINS"
  | "TITLE_CONTAINS"
  | "TITLE_MATCHES"
  | "SOURCE_CONTAINS"
  | "ATTRIBUTE_EQUALS"
  | "CSS_RULE_EXISTS"
  | "HOVER_STYLE"
  | "PAGE_EXECUTION"
  | "JS_EXECUTION"
  | "PROMPT_FLOW";

export interface WebAction {
  type: "click" | "fill" | "submit";
  selector: string;
  value?: string;
}

export interface WebRule {
  id: string;
  type: WebRuleType;
  label: string;
  group?: string;
  selector?: string;
  attribute?: string;
  expected?: string;
  score: number;
  promptInputs?: string[];
  actions?: WebAction[];
}

export interface Problem {
  id: string;
  name: string;
  targetFilePattern: string;
  points: number;
  scoringMode?: "SUM" | "DEDUCT";
  deductionPerFail?: number;
  gradingGuide?: string;
  javaTestCases: JavaTestCase[];
  javaRequirements: JavaRequirement[];
  webRules: WebRule[];
}

export interface Assignment {
  id: string;
  courseName: string;
  title: string;
  type: AssignmentType;
  problems: Problem[];
}
