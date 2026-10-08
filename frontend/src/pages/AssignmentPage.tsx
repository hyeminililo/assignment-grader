import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Download, Play, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AssignmentTypeSelector } from "../components/AssignmentTypeSelector";
import { FileUploader } from "../components/FileUploader";
import { GradingProgress } from "../components/GradingProgress";
import { ProblemEditor } from "../components/ProblemEditor";
import { ResultTable } from "../components/ResultTable";
import { StudentResultDetail } from "../components/StudentResultDetail";
import { csvUrl, getGradeJob, startGrading, updateManualAdjustment } from "../api/grader";
import type { Assignment, AssignmentType, Problem } from "../types/assignment";
import type { GradeJob, GradeJobProgress, StudentGradeResult } from "../types/grading";

const STORAGE_KEY = "assignment-grader:draft:v1";

interface DraftState {
  assignmentType: AssignmentType;
  courseName: string;
  title: string;
  problems: Problem[];
  javaProblemTexts: string[];
  webProblemTexts: { problemOne: string; problemTwo: string };
  concurrency: number;
}

export default function AssignmentPage() {
  const savedDraft = useMemo(loadDraft, []);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(savedDraft.assignmentType);
  const [courseName, setCourseName] = useState(savedDraft.courseName);
  const [title, setTitle] = useState(savedDraft.title);
  const [problems, setProblems] = useState<Problem[]>(savedDraft.problems);
  const [javaProblemTexts, setJavaProblemTexts] = useState(savedDraft.javaProblemTexts);
  const [webProblemTexts, setWebProblemTexts] = useState(savedDraft.webProblemTexts);
  const [files, setFiles] = useState<File[]>([]);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [concurrency, setConcurrency] = useState(savedDraft.concurrency);
  const [jobId, setJobId] = useState<string>();
  const [progress, setProgress] = useState<GradeJobProgress>();
  const [selected, setSelected] = useState<StudentGradeResult>();

  const assignment: Assignment = useMemo(
    () => ({ id: "draft", courseName, title, type: assignmentType, problems }),
    [assignmentType, courseName, problems, title]
  );

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getGradeJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: progress?.status === "done" ? false : 1500
  });

  const startMutation = useMutation({
    mutationFn: () => startGrading(assignment, files, answerFiles[0], concurrency),
    onSuccess: (job: GradeJob) => {
      setJobId(job.id);
      setProgress(job.progress);
      setSelected(undefined);
    }
  });

  const manualMutation = useMutation({
    mutationFn: ({ studentId, adjustment, reason }: { studentId: string; adjustment: number; reason: string }) =>
      updateManualAdjustment(jobId!, studentId, adjustment, reason),
    onSuccess: () => void jobQuery.refetch()
  });

  const changeAssignmentType = (nextType: AssignmentType) => {
    setAssignmentType(nextType);
    setCourseName(nextType === "JAVA" ? "Java 프로그래밍" : "백엔드 프로그래밍");
    setTitle(nextType === "JAVA" ? "J1 과제" : "BE1 과제");
    setProblems(defaultProblems(nextType));
    setJavaProblemTexts([""]);
    setWebProblemTexts({ problemOne: "", problemTwo: "" });
    setJobId(undefined);
    setProgress(undefined);
    setSelected(undefined);
  };

  useEffect(() => {
    const draft: DraftState = { assignmentType, courseName, title, problems, javaProblemTexts, webProblemTexts, concurrency };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [assignmentType, courseName, concurrency, javaProblemTexts, problems, title, webProblemTexts]);

  useEffect(() => {
    if (!jobId) return;
    const source = new EventSource(`/api/grade/jobs/${jobId}/events`);
    source.onmessage = (event) => {
      const nextProgress = JSON.parse(event.data) as GradeJobProgress;
      setProgress(nextProgress);
      if (nextProgress.status === "done") {
        void jobQuery.refetch();
      }
    };
    return () => source.close();
  }, [jobId]);

  useEffect(() => {
    if (!jobQuery.data) return;
    if (!selected) {
      setSelected(jobQuery.data.results[0]);
      return;
    }
    const updated = jobQuery.data.results.find((result) => result.student.studentId === selected.student.studentId);
    if (updated) setSelected(updated);
  }, [jobQuery.data]);

  const results = jobQuery.data?.results ?? [];
  const totalPoints = problems.reduce((sum, problem) => sum + problem.points, 0);

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">Assignment Grader</h1>
            <p className="text-sm text-gray-600">답안 ZIP과 학생 ZIP 제출물을 비교해 자동 채점합니다</p>
          </div>
          {jobId && (
            <a className="quiet-button" href={csvUrl(jobId)}>
              <Download size={16} /> CSV
            </a>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-5 xl:grid-cols-[430px_1fr]">
        <div className="space-y-5">
          <section className="card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">과제 생성</h2>
              <span className="badge bg-blue-100 text-blue-800">총 {totalPoints}점</span>
            </div>
            <div className="space-y-3">
              <AssignmentTypeSelector value={assignmentType} onChange={changeAssignmentType} />
              <label className="text-xs font-medium">수업명<input value={courseName} onChange={(event) => setCourseName(event.target.value)} /></label>
              <label className="text-xs font-medium">과제명<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label className="text-xs font-medium">동시 실행 수<input type="number" min={1} max={4} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></label>
            </div>
          </section>

          <FileUploader
            title="학생 제출물 업로드"
            description={assignmentType === "JAVA" ? "ZIP 또는 .java 파일 여러 개를 올립니다" : "ZIP 또는 웹 소스 파일 여러 개를 올립니다"}
            accept={assignmentType === "JAVA" ? ".zip,.java" : ".zip,.html,.htm,.css,.js,.jsp,.xml"}
            files={files}
            onChange={setFiles}
          />
          <FileUploader
            title="답안 파일 업로드"
            description={assignmentType === "JAVA" ? "ZIP 또는 .java 파일을 올립니다" : "ZIP 또는 웹 소스 파일을 올립니다"}
            accept={assignmentType === "JAVA" ? ".zip,.java" : ".zip,.html,.htm,.css,.js,.jsp,.xml"}
            multiple={false}
            files={answerFiles}
            onChange={setAnswerFiles}
          />
          <button
            className="primary-button w-full"
            type="button"
            disabled={!files.length || !problems.length || startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            <Play size={16} /> 채점 시작
          </button>
          {startMutation.error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{String(startMutation.error)}</div>}
          <GradingProgress progress={progress} />
        </div>

        <div className="space-y-5">
          {assignmentType === "JAVA" && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Java 문제별 내용 붙여넣기</h3>
                <div className="flex gap-2">
                  <button type="button" className="quiet-button" onClick={() => setJavaProblemTexts([...javaProblemTexts, ""])}>
                    <Plus size={16} /> 문제 추가
                  </button>
                  <button type="button" className="quiet-button" onClick={() => setProblems(problemsFromJavaProblemTexts(javaProblemTexts))}>
                    <ClipboardList size={16} /> 테스트/요구사항 생성
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {javaProblemTexts.map((problemText, index) => (
                  <div className="rounded border border-line p-3" key={index}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">문제 {index + 1}</span>
                      {javaProblemTexts.length > 1 && (
                        <button type="button" className="quiet-button px-2" onClick={() => setJavaProblemTexts(javaProblemTexts.filter((_, itemIndex) => itemIndex !== index))}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <label className="text-xs font-medium">
                      문제 내용
                      <textarea
                        rows={8}
                        value={problemText}
                        onChange={(event) => setJavaProblemTexts(javaProblemTexts.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                        placeholder={`문제 ${index + 1}의 Scanner 입력, 연산 조건, 실행 예시를 붙여넣으세요.`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          )}
          {assignmentType === "WEB" && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">문제별 과제 내용 붙여넣기</h3>
                <button type="button" className="quiet-button" onClick={() => setProblems(problemsFromWebProblemTexts(webProblemTexts.problemOne, webProblemTexts.problemTwo))}>
                  <ClipboardList size={16} /> 규칙 생성
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="text-xs font-medium">
                  문제 01 내용
                  <textarea
                    rows={12}
                    value={webProblemTexts.problemOne}
                    onChange={(event) => setWebProblemTexts((current) => ({ ...current, problemOne: event.target.value }))}
                    placeholder="문제 01 과제 내용을 붙여넣으세요."
                  />
                </label>
                <label className="text-xs font-medium">
                  문제 02 내용
                  <textarea
                    rows={12}
                    value={webProblemTexts.problemTwo}
                    onChange={(event) => setWebProblemTexts((current) => ({ ...current, problemTwo: event.target.value }))}
                    placeholder="문제 02 과제 내용을 붙여넣으세요."
                  />
                </label>
              </div>
            </section>
          )}
          <ProblemEditor type={assignmentType} problems={problems} onChange={setProblems} />
          {results.length > 0 && (
            <div className="grid gap-5 2xl:grid-cols-[minmax(520px,1fr)_520px]">
              <ResultTable results={results} selectedStudentId={selected?.student.studentId} onSelect={setSelected} />
              <StudentResultDetail
                result={selected}
                onSaveManual={(studentId, adjustment, reason) => manualMutation.mutate({ studentId, adjustment, reason })}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function defaultProblems(type: AssignmentType): Problem[] {
  if (type === "WEB") return [webProblemOne(), webProblemTwo()];
  return [
    {
      id: crypto.randomUUID(),
      name: "분식점 가격 계산",
      targetFilePattern: "Snack.java",
      points: 5,
      scoringMode: "DEDUCT",
      deductionPerFail: 0.5,
      gradingGuide: "",
      javaTestCases: [{ id: crypto.randomUUID(), label: "분식점 예시 입력", input: "3\n4\n2", expectedOutput: "전체 금액은 16000원입니다.", score: 0.5, comparisonMode: "CONTAINS", timeoutMs: 3000 }],
      javaRequirements: defaultJavaRequirements(),
      webRules: []
    }
  ];
}

function loadDraft(): DraftState {
  const fallbackType: AssignmentType = "JAVA";
  const fallback: DraftState = {
    assignmentType: fallbackType,
    courseName: "Java 프로그래밍",
    title: "J1 과제",
    problems: defaultProblems(fallbackType),
    javaProblemTexts: [""],
    webProblemTexts: { problemOne: "", problemTwo: "" },
    concurrency: 2
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    const assignmentType = parsed.assignmentType === "WEB" || parsed.assignmentType === "JAVA" ? parsed.assignmentType : fallback.assignmentType;
    const problems = Array.isArray(parsed.problems) && parsed.problems.length > 0 ? parsed.problems : defaultProblems(assignmentType);
    return {
      assignmentType,
      courseName: typeof parsed.courseName === "string" ? parsed.courseName : assignmentType === "JAVA" ? "Java 프로그래밍" : "백엔드 프로그래밍",
      title: typeof parsed.title === "string" ? parsed.title : assignmentType === "JAVA" ? "J1 과제" : "BE1 과제",
      problems,
      javaProblemTexts: loadJavaProblemTexts(parsed),
      webProblemTexts: {
        problemOne: typeof parsed.webProblemTexts?.problemOne === "string" ? parsed.webProblemTexts.problemOne : "",
        problemTwo: typeof parsed.webProblemTexts?.problemTwo === "string" ? parsed.webProblemTexts.problemTwo : ""
      },
      concurrency: typeof parsed.concurrency === "number" ? parsed.concurrency : 2
    };
  } catch {
    return fallback;
  }
}

function loadJavaProblemTexts(parsed: Partial<DraftState> & { javaProblemText?: string }): string[] {
  if (Array.isArray(parsed.javaProblemTexts)) {
    const texts = parsed.javaProblemTexts.filter((item): item is string => typeof item === "string");
    return texts.length > 0 ? texts : [""];
  }
  if (typeof parsed.javaProblemText === "string" && parsed.javaProblemText.trim()) return [parsed.javaProblemText];
  return [""];
}

function problemsFromJavaProblemTexts(problemTexts: string[]): Problem[] {
  const normalizedTexts = problemTexts.map((text) => text.replace(/\r\n/g, "\n").trim()).filter(Boolean);
  if (normalizedTexts.length === 0) return defaultProblems("JAVA");
  return normalizedTexts.map((text, index) => problemFromJavaProblemText(text, index + 1));
}

function problemFromJavaProblemText(text: string, problemNumber: number): Problem {
  const example = extractJavaExample(text);
  const requirements = javaRequirementsFromText(text);
  const problemName = javaProblemNameFromText(text, problemNumber);
  return {
    id: crypto.randomUUID(),
    name: problemName,
    targetFilePattern: javaTargetFileNameFromText(text, problemName),
    points: 5,
    scoringMode: "DEDUCT",
    deductionPerFail: 0.5,
    gradingGuide: text,
    javaTestCases: [
      {
        id: crypto.randomUUID(),
        label: example.label,
        input: example.input,
        expectedOutput: example.expectedOutput,
        score: 0.5,
        comparisonMode: "CONTAINS",
        timeoutMs: 3000
      }
    ],
    javaRequirements: requirements,
    webRules: []
  };
}

function javaRequirementsFromText(text: string): Problem["javaRequirements"] {
  const requirements: Problem["javaRequirements"] = [...defaultJavaRequirements()];
  if (/next\s*Int|nextlnt|nextInt/i.test(text)) {
    requirements.push({ id: crypto.randomUUID(), type: "SOURCE_CONTAINS", label: "nextInt() 메소드 사용", expected: "nextInt", score: 0.5 });
  }
  if (/\/|나누|년도|월|일/.test(text)) {
    requirements.push({ id: crypto.randomUUID(), type: "SOURCE_CONTAINS", label: "나눗셈 연산자 사용", expected: "/", score: 0.5 });
  }
  if (/%|나머지/.test(text)) {
    requirements.push({ id: crypto.randomUUID(), type: "SOURCE_CONTAINS", label: "나머지 연산자 사용", expected: "%", score: 0.5 });
  }
  if (/8\s*자리|8자리/.test(text)) {
    requirements.push({ id: crypto.randomUUID(), type: "SOURCE_CONTAINS", label: "8자리 정수 처리 변수/계산", expected: "10000", score: 0.5 });
  }
  return requirements;
}

function extractJavaExample(text: string): { label: string; input: string; expectedOutput: string } {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const promptLineIndex = lines.findIndex((line) => /[>＞]{1,3}\s*\d+/.test(line));
  if (promptLineIndex >= 0) {
    const input = lines[promptLineIndex].match(/[>＞]{1,3}\s*([+-]?\d+(?:\s+[+-]?\d+)*)/)?.[1]?.trim() ?? "";
    const expectedOutput = lines.slice(promptLineIndex + 1).find((line) => looksLikeJavaExpectedOutput(line)) ?? "";
    if (input && expectedOutput) return { label: "지문 예시 입력", input: input.replace(/\s+/g, "\n"), expectedOutput };
  }

  const numericLines = lines.filter((line) => /^[+-]?\d+$/.test(line));
  const outputLine = lines.find((line) => looksLikeJavaExpectedOutput(line));
  return {
    label: "지문 예시 입력",
    input: numericLines[0] ?? "",
    expectedOutput: outputLine ?? ""
  };
}

function looksLikeJavaExpectedOutput(line: string): boolean {
  return /(년|월|일|원|입니다|결과|출력|합계|전체|금액)/.test(line) && !/[>＞]{1,3}/.test(line);
}

function javaProblemNameFromText(text: string, problemNumber: number): string {
  const prefix = `문제 ${String(problemNumber).padStart(2, "0")}`;
  if (/생일|년도|월|일/.test(text)) return `${prefix} 생일 년월일 분리`;
  if (/분식|떡볶이|김말이|쫄면/.test(text)) return `${prefix} 분식점 가격 계산`;
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !/^문제\s*\d+/.test(line));
  return firstLine ? `${prefix} ${firstLine.slice(0, 24)}` : prefix;
}

function javaTargetFileNameFromText(text: string, problemName: string): string {
  const explicitFileName = extractFileName(text);
  if (explicitFileName?.endsWith(".java")) return explicitFileName;
  return "*.java";
}

function problemsFromWebProblemTexts(problemOneText: string, problemTwoText: string): Problem[] {
  const problems: Problem[] = [];
  const normalizedProblemOne = problemOneText.replace(/\r\n/g, "\n").trim();
  const normalizedProblemTwo = problemTwoText.replace(/\r\n/g, "\n").trim();

  if (!normalizedProblemOne && !normalizedProblemTwo) return defaultProblems("WEB");

  if (normalizedProblemOne) {
    problems.push(problemFromWebProblemText(normalizedProblemOne, 1));
  }

  if (normalizedProblemTwo) {
    problems.push(problemFromWebProblemText(normalizedProblemTwo, 2));
  }

  return problems.length > 0 ? problems : defaultProblems("WEB");
}

function webProblemOne(): Problem {
  return withDeductionScoring({
    id: crypto.randomUUID(),
    name: "문제 01 스터디룸 예약 현황표",
    targetFilePattern: "be1-1.html",
    points: 10,
    gradingGuide: "비정형 표, 병합 셀, CSS, hover 조건을 항목별로 검사합니다.",
    javaTestCases: [],
    javaRequirements: [],
    webRules: [
      rule("TITLE_MATCHES", "title 형식 be1-1_이름_학번", 5, { group: "title 태그", expected: "^be1-1_.+_.+$" }),
      rule("ELEMENT_EXISTS", "table 요소", 5, { group: "테이블 작성 조건", selector: "table" }),
      rule("ELEMENT_EXISTS", "caption 요소", 5, { group: "테이블 작성 조건", selector: "caption" }),
      rule("TEXT_CONTAINS", "caption 텍스트: 스터디룸", 5, { group: "테이블 작성 조건", expected: "스터디룸" }),
      rule("TEXT_CONTAINS", "caption 텍스트: 예약 현황", 5, { group: "테이블 작성 조건", expected: "예약 현황" }),
      rule("CSS_RULE_EXISTS", "table border", 5, { group: "테이블 작성 조건", selector: "table", expected: "border:1pxsolidgray" }),
      rule("CSS_RULE_EXISTS", "table border-collapse", 5, { group: "테이블 작성 조건", selector: "table", expected: "border-collapse:collapse" }),
      rule("CSS_RULE_EXISTS", "caption 글자 크기", 5, { group: "테이블 작성 조건", selector: "caption", expected: "font-size:1.3" }),
      rule("CSS_RULE_EXISTS", "caption 아래 여백", 5, { group: "테이블 작성 조건", selector: "caption", expected: "margin-bottom:15px" }),
      rule("CSS_RULE_EXISTS", "caption 굵게", 5, { group: "테이블 작성 조건", selector: "caption", expected: "font-weight:bold" }),
      rule("CSS_RULE_EXISTS", "th 배경색", 5, { group: "테이블 작성 조건", selector: "th", expected: "background-color:aliceblue" }),
      rule("CSS_RULE_EXISTS", "th 위아래 여백", 5, { group: "테이블 작성 조건", selector: "th", expected: "padding:8px" }),
      rule("CSS_RULE_EXISTS", "td 가운데 정렬", 5, { group: "테이블 작성 조건", selector: "td", expected: "text-align:center" }),
      rule("CSS_RULE_EXISTS", "th 가운데 정렬", 5, { group: "테이블 작성 조건", selector: "th", expected: "text-align:center" }),
      rule("CSS_RULE_EXISTS", "td 수직 가운데 정렬", 5, { group: "테이블 작성 조건", selector: "td", expected: "vertical-align:middle" }),
      rule("CSS_RULE_EXISTS", "첫째 열 너비 80px", 5, { group: "클래스 셀렉터 활용", selector: ".time", expected: "width:80px" }),
      rule("CSS_RULE_EXISTS", "첫째 열 배경색 #f9f9f9", 5, { group: "클래스 셀렉터 활용", selector: ".time", expected: "background-color:#f9f9f9" }),
      rule("CSS_RULE_EXISTS", "요일 열 너비 150px", 5, { group: "클래스 셀렉터 활용", selector: ".day", expected: "width:150px" }),
      rule("ATTRIBUTE_EQUALS", "월~금 통합 colspan=5", 10, { group: "비정형 병합 조건", selector: "td", attribute: "colspan", expected: "5" }),
      rule("ATTRIBUTE_EQUALS", "2시간 연속 rowspan=2", 10, { group: "비정형 병합 조건", selector: "td", attribute: "rowspan", expected: "2" }),
      rule("ATTRIBUTE_EQUALS", "3시간 연속 rowspan=3", 10, { group: "비정형 병합 조건", selector: "td", attribute: "rowspan", expected: "3" }),
      rule("TEXT_CONTAINS", "웹개발 프로젝트 회의", 5, { group: "비정형 병합 조건", expected: "웹개발 프로젝트 회의" }),
      rule("TEXT_CONTAINS", "정기 점검 및 청소 시간", 5, { group: "비정형 병합 조건", expected: "정기 점검 및 청소 시간" }),
      rule("TEXT_CONTAINS", "알고리즘 스터디", 5, { group: "비정형 병합 조건", expected: "알고리즘 스터디" }),
      rule("TEXT_CONTAINS", "멘토링 세션", 5, { group: "비정형 병합 조건", expected: "멘토링 세션" }),
      rule("SOURCE_CONTAINS", "hover 가상 클래스 코드", 5, { group: "가상 클래스 조건", expected: ":hover" }),
      rule("SOURCE_CONTAINS", "웹개발 프로젝트 회의 hover 색상", 5, { group: "가상 클래스 조건", expected: "plum" }),
      rule("SOURCE_CONTAINS", "정기 점검 및 청소 시간 hover 색상", 5, { group: "가상 클래스 조건", expected: "lightgray" }),
      rule("SOURCE_CONTAINS", "알고리즘 스터디 hover 색상", 5, { group: "가상 클래스 조건", expected: "mediumaquamarine" }),
      rule("SOURCE_CONTAINS", "멘토링 세션 hover 색상", 5, { group: "가상 클래스 조건", expected: "sandybrown" })
    ]
  });
}

function webProblemTwo(): Problem {
  return withDeductionScoring({
    id: crypto.randomUUID(),
    name: "문제 02 카페 음료 주문 금액",
    targetFilePattern: "be1-2.html",
    points: 10,
    gradingGuide: "prompt 입력 흐름과 화면 출력 결과를 검사합니다.",
    javaTestCases: [],
    javaRequirements: [],
    webRules: [
      rule("TITLE_MATCHES", "title 형식 be1-2_이름_학번", 5, { group: "title 태그", expected: "^be1-2_.+_.+$" }),
      rule("SOURCE_CONTAINS", "prompt 사용", 5, { group: "입력 조건", expected: "prompt" }),
      rule("SOURCE_CONTAINS", "종료값 0 처리", 5, { group: "입력 조건", expected: "0" }),
      rule("SOURCE_CONTAINS", "15000원 이상 할인 기준", 5, { group: "계산 조건", expected: "15000" }),
      rule("SOURCE_CONTAINS", "1000원 할인", 5, { group: "계산 조건", expected: "1000" }),
      rule("PROMPT_FLOW", "예시 입력: 총 3잔", 10, { group: "출력 조건", expected: "총 3잔", promptInputs: ["4500", "6000", "5000", "0"] }),
      rule("PROMPT_FLOW", "예시 입력: 합계 15500원", 10, { group: "출력 조건", expected: "15500원", promptInputs: ["4500", "6000", "5000", "0"] }),
      rule("PROMPT_FLOW", "예시 입력: 최종 14500원", 10, { group: "출력 조건", expected: "14500원", promptInputs: ["4500", "6000", "5000", "0"] }),
      rule("PROMPT_FLOW", "첫 입력 0: 주문 내역 없음", 15, { group: "출력 조건", expected: "주문 내역이 없습니다", promptInputs: ["0"] }),
      rule("PROMPT_FLOW", "할인 미적용 케이스", 10, { group: "출력 조건", expected: "9000원", promptInputs: ["4000", "5000", "0"] })
    ]
  });
}

function rule(type: Problem["webRules"][number]["type"], label: string, score: number, patch: Partial<Problem["webRules"][number]>): Problem["webRules"][number] {
  return { id: crypto.randomUUID(), type, label, score, ...patch };
}

function withDeductionScoring(problem: Problem): Problem {
  problem.points = 5;
  problem.scoringMode = "DEDUCT";
  problem.deductionPerFail = 0.5;
  problem.webRules = problem.webRules.map((rule) => ({ ...rule, score: 0.5 }));
  return problem;
}

function problemFromWebProblemText(text: string, fallbackProblemNumber: number): Problem {
  const problemNumber = Number(text.match(/문제\s*0?(\d+)/)?.[1] ?? fallbackProblemNumber);
  const fallback = problemNumber === 2 ? webProblemTwo() : webProblemOne();
  const fileName = extractFileName(text) ?? fallback.targetFilePattern;
  const sections = splitRequirementSections(text);
  const rules: Problem["webRules"] = [];

  addFileAndTitleRules(rules, sections.get("title 태그") ?? text, fileName);
  addTableRules(rules, sections.get("테이블 작성 조건") ?? "");
  addClassSelectorRules(rules, sections.get("클래스 셀렉터 활용") ?? sections.get("클래그 셀렉터 활용") ?? "");
  addMergedCellRules(rules, sections.get("비정형 병합 조건") ?? "");
  addHoverRules(rules, sections.get("가상 클래스 조건") ?? "");
  addPromptAndCalculationRules(rules, sections, text);

  return withDeductionScoring({
    id: crypto.randomUUID(),
    name: extractProblemName(text, problemNumber),
    targetFilePattern: fileName,
    points: 5,
    gradingGuide: text,
    javaTestCases: [],
    javaRequirements: [],
    webRules: rules.length > 0 ? rules : fallback.webRules
  });
}

function defaultJavaRequirements(): Problem["javaRequirements"] {
  return [
    { id: crypto.randomUUID(), type: "METADATA_FIELDS", label: "학기/과목/과제/소속/이름/학번 명시", score: 0.5 },
    { id: crypto.randomUUID(), type: "MAIN_METHOD", label: "main 메서드 작성", score: 0.5 },
    { id: crypto.randomUUID(), type: "USES_SCANNER", label: "Scanner 입력 사용", score: 0.5 }
  ];
}

function extractFileName(text: string): string | undefined {
  return text.match(/파일\s*이름\s*[:：]\s*([^\s\n]+)/)?.[1]?.trim();
}

function extractProblemName(text: string, problemNumber: number): string {
  const firstMeaningfulLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !/^문제\s*\d+/.test(line) && !/^파일\s*이름/.test(line));
  return firstMeaningfulLine ? `문제 ${String(problemNumber).padStart(2, "0")} ${firstMeaningfulLine.slice(0, 24)}` : `문제 ${String(problemNumber).padStart(2, "0")}`;
}

function splitRequirementSections(text: string): Map<string, string> {
  const headingAliases: Record<string, string> = {
    "title 태그": "title 태그",
    "테이블 작성 조건": "테이블 작성 조건",
    "클래스 셀렉터 활용": "클래스 셀렉터 활용",
    "클래그 셀렉터 활용": "클래그 셀렉터 활용",
    "비정형 병합 조건": "비정형 병합 조건",
    "가상 클래스 조건": "가상 클래스 조건",
    "입력 조건": "입력 조건",
    "계산 조건": "계산 조건",
    "출력 조건": "출력 조건"
  };
  const headings = Object.keys(headingAliases).map(escapeRegExp).join("|");
  const headingPattern = new RegExp(`^\\s*(${headings})\\s*[:：]\\s*(.*)$`);
  const sections = new Map<string, string>();
  let current = "기본 조건";

  for (const line of text.split("\n")) {
    const match = line.match(headingPattern);
    if (match) {
      current = headingAliases[match[1]];
      if (!sections.has(current)) sections.set(current, "");
      if (match[2]) sections.set(current, `${sections.get(current) ?? ""}${match[2]}\n`);
      continue;
    }
    sections.set(current, `${sections.get(current) ?? ""}${line}\n`);
  }

  return sections;
}

function addFileAndTitleRules(rules: Problem["webRules"], titleText: string, fileName: string): void {
  if (!/title/i.test(titleText) && !fileName) return;
  const titlePrefix =
    titleText.match(/title\s*태그\s*[:：]\s*([^\s(]+)/i)?.[1] ??
    titleText.match(/([a-z0-9-]+_이름_학번)/i)?.[1] ??
    fileName.replace(/\.html?$/i, "");
  const titlePattern = titlePrefix
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/이름/g, ".+")
    .replace(/학번/g, "\\d{4,}");
  rules.push(rule("TITLE_MATCHES", `title 형식 ${titlePrefix}`, 0.5, { group: "title 태그", expected: `^${titlePattern}$` }));
}

function addTableRules(rules: Problem["webRules"], section: string): void {
  if (!section.trim()) return;
  rules.push(rule("ELEMENT_EXISTS", "table 요소", 0.5, { group: "테이블 작성 조건", selector: "table" }));
  if (/caption|표\s*제목/.test(section)) rules.push(rule("ELEMENT_EXISTS", "caption 요소", 0.5, { group: "테이블 작성 조건", selector: "caption" }));
  addTextRule(rules, "테이블 작성 조건", section, "스터디룸");
  addTextRule(rules, "테이블 작성 조건", section, "예약 현황");
  addCssRule(rules, "테이블 작성 조건", section, /1px|실선|solid|gray/, "table", "border:1pxsolidgray", "표 테두리 1px solid gray");
  addCssRule(rules, "테이블 작성 조건", section, /border-collapse|겹침\s*제거/, "table", "border-collapse:collapse", "테두리 겹침 제거");
  addCssRule(rules, "테이블 작성 조건", section, /1\.3|1\.3배/, "caption", "font-size:1.3", "caption 글자 크기");
  addCssRule(rules, "테이블 작성 조건", section, /15px|아래.*여백/, "caption", "margin-bottom:15px", "caption 아래 여백");
  addCssRule(rules, "테이블 작성 조건", section, /bold|굵기|진하게/, "caption", "font-weight:bold", "caption 굵게");
  addCssRule(rules, "테이블 작성 조건", section, /aliceblue|제목행/, "th", "background-color:aliceblue", "th 배경색");
  addCssRule(rules, "테이블 작성 조건", section, /8px|안쪽\s*여백/, "th", "padding:8px", "th 위아래 여백");
  addCssRule(rules, "테이블 작성 조건", section, /텍스트\s*정렬|가운데/, "td", "text-align:center", "td 가운데 정렬");
  addCssRule(rules, "테이블 작성 조건", section, /텍스트\s*정렬|가운데/, "th", "text-align:center", "th 가운데 정렬");
  addCssRule(rules, "테이블 작성 조건", section, /수직\s*정렬|수직.*가운데/, "td", "vertical-align:middle", "td 수직 가운데 정렬");
}

function addClassSelectorRules(rules: Problem["webRules"], section: string): void {
  if (!section.trim()) return;
  rules.push(rule("SOURCE_CONTAINS", "클래스 셀렉터 사용", 0.5, { group: "클래스 셀렉터 활용", expected: "." }));
  addSourceRule(rules, "클래스 셀렉터 활용", section, /80px/, "80px", "첫째 열 너비 80px");
  addSourceRule(rules, "클래스 셀렉터 활용", section, /#f9f9f9/i, "#f9f9f9", "첫째 열 배경색 #f9f9f9");
  addSourceRule(rules, "클래스 셀렉터 활용", section, /150px/, "150px", "요일 열 너비 150px");
}

function addMergedCellRules(rules: Problem["webRules"], section: string): void {
  if (!section.trim()) return;
  for (const text of quotedTexts(section)) {
    rules.push(rule("TEXT_CONTAINS", text, 0.5, { group: "비정형 병합 조건", expected: text }));
  }
  if (/5개\s*요일|월\s*~\s*금|전체/.test(section)) {
    rules.push(rule("ATTRIBUTE_EQUALS", "월~금 통합 colspan=5", 0.5, { group: "비정형 병합 조건", selector: "td", attribute: "colspan", expected: "5" }));
  }
  if (/2시간/.test(section)) {
    rules.push(rule("ATTRIBUTE_EQUALS", "2시간 연속 rowspan=2", 0.5, { group: "비정형 병합 조건", selector: "td", attribute: "rowspan", expected: "2" }));
  }
  if (/3시간/.test(section)) {
    rules.push(rule("ATTRIBUTE_EQUALS", "3시간 연속 rowspan=3", 0.5, { group: "비정형 병합 조건", selector: "td", attribute: "rowspan", expected: "3" }));
  }
}

function addHoverRules(rules: Problem["webRules"], section: string): void {
  if (!section.trim()) return;
  rules.push(rule("SOURCE_CONTAINS", "hover 가상 클래스 코드", 0.5, { group: "가상 클래스 조건", expected: ":hover" }));
  for (const token of ["plum", "white", "lightgray", "italic", "mediumaquamarine", "sandybrown"]) {
    if (section.includes(token)) {
      rules.push(rule("SOURCE_CONTAINS", `hover 조건: ${token}`, 0.5, { group: "가상 클래스 조건", expected: token }));
    }
  }
}

function addPromptAndCalculationRules(rules: Problem["webRules"], sections: Map<string, string>, allText: string): void {
  const input = sections.get("입력 조건") ?? "";
  const calculation = sections.get("계산 조건") ?? "";
  const output = sections.get("출력 조건") ?? "";
  if (!input && !calculation && !output && !/prompt|Javascript|JavaScript/i.test(allText)) return;
  if (/prompt/i.test(input) || /prompt/i.test(allText)) rules.push(rule("SOURCE_CONTAINS", "prompt 사용", 0.5, { group: "입력 조건", expected: "prompt" }));
  addSourceRule(rules, "입력 조건", input || allText, /0/, "0", "종료값 0 처리");
  addSourceRule(rules, "계산 조건", calculation, /15000|15,000/, "15000", "15000원 이상 할인 기준");
  addSourceRule(rules, "계산 조건", calculation, /1000|1,000/, "1000", "1000원 할인");
  const promptInputs = extractPromptInputs(allText) ?? ["4500", "6000", "5000", "0"];
  for (const expected of quotedTexts(output)) {
    rules.push(rule("PROMPT_FLOW", `출력 확인: ${expected}`, 0.5, { group: "출력 조건", expected, promptInputs }));
  }
  for (const expected of ["총 3잔", "15500원", "14500원"]) {
    if (allText.replace(/,/g, "").includes(expected.replace(/,/g, ""))) {
      rules.push(rule("PROMPT_FLOW", `예시 입력: ${expected}`, 0.5, { group: "출력 조건", expected, promptInputs }));
    }
  }
}

function addTextRule(rules: Problem["webRules"], group: string, section: string, expected: string): void {
  if (section.includes(expected)) rules.push(rule("TEXT_CONTAINS", `${expected} 텍스트`, 0.5, { group, expected }));
}

function addCssRule(rules: Problem["webRules"], group: string, section: string, pattern: RegExp, selector: string, expected: string, label: string): void {
  if (pattern.test(section)) rules.push(rule("CSS_RULE_EXISTS", label, 0.5, { group, selector, expected }));
}

function addSourceRule(rules: Problem["webRules"], group: string, section: string, pattern: RegExp, expected: string, label: string): void {
  if (pattern.test(section)) rules.push(rule("SOURCE_CONTAINS", label, 0.5, { group, expected }));
}

function quotedTexts(text: string): string[] {
  return Array.from(text.matchAll(/["“”']([^"“”']+)["“”']/g), (match) => match[1].trim()).filter(Boolean);
}

function extractPromptInputs(text: string): string[] | undefined {
  const match = text.match(/입력\s*순서\s*[:：]\s*([0-9,\s]+)/);
  if (!match) return undefined;
  const values = match[1].split(",").map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
