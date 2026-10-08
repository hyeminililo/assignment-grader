import fs from "node:fs/promises";
import path from "node:path";
import { runJavaProcess } from "./javaProcessRunner.js";

export async function compileJavaFile(projectPath: string, relativeJavaPath: string, timeoutMs: number) {
  const outDir = "out";
  const cwd = path.resolve(projectPath);
  await fs.mkdir(path.join(cwd, outDir), { recursive: true });
  return runJavaProcess({
    command: "javac",
    args: ["-encoding", "UTF-8", "-d", outDir, relativeJavaPath],
    cwd,
    timeoutMs,
    stdoutLimitBytes: 64 * 1024
  });
}
