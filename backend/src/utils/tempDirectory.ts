import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempDirectory(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

export async function removeDirectory(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
