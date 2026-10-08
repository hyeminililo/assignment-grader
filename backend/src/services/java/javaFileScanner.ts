import { scanProject, matchesTarget, type ProjectFile } from "../archive/projectScanner.js";

export async function findJavaFiles(projectPath: string): Promise<ProjectFile[]> {
  return scanProject(projectPath, [".java"]);
}

export async function findTargetJavaFile(projectPath: string, pattern: string): Promise<ProjectFile | undefined> {
  const files = await findJavaFiles(projectPath);
  return files.find((file) => matchesTarget(file, pattern));
}
