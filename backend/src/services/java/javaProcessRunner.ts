import { spawn } from "node:child_process";

export interface JavaProcessRunOptions {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
  timeoutMs: number;
  stdoutLimitBytes?: number;
}

export interface JavaProcessRunResult {
  status: "OK" | "TIMEOUT" | "OUTPUT_LIMIT" | "ERROR";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export async function runJavaProcess(options: JavaProcessRunOptions): Promise<JavaProcessRunResult> {
  const stdoutLimit = options.stdoutLimitBytes ?? 64 * 1024;

  return new Promise((resolve) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      resolve({ status: "TIMEOUT", exitCode: null, stdout, stderr });
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") > stdoutLimit && !settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        resolve({ status: "OUTPUT_LIMIT", exitCode: null, stdout: stdout.slice(0, stdoutLimit), stderr });
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: "ERROR", exitCode: null, stdout, stderr, error: error.message });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: "OK", exitCode, stdout, stderr });
    });

    if (options.stdin) child.stdin.write(options.stdin);
    child.stdin.end();
  });
}
