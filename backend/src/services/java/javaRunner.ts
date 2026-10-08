import path from "node:path";
import { runJavaProcess } from "./javaProcessRunner.js";

export async function runJavaMain(projectPath: string, fullyQualifiedClassName: string, input: string, timeoutMs: number) {
  return runJavaProcess({
    command: "java",
    args: ["-cp", "out", fullyQualifiedClassName],
    cwd: path.resolve(projectPath),
    stdin: formatScannerInput(input),
    timeoutMs,
    stdoutLimitBytes: 64 * 1024
  });
}

function formatScannerInput(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return "";
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}
