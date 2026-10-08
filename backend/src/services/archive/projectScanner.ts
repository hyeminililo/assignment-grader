import fs from "node:fs/promises";
import path from "node:path";

export interface ProjectFile {
  absolutePath: string;
  relativePath: string;
  name: string;
  extension: string;
}

export async function scanProject(root: string, extensions: string[]): Promise<ProjectFile[]> {
  const wanted = new Set(extensions.map((ext) => ext.toLowerCase()));
  const files: ProjectFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else {
        const extension = path.extname(entry.name).toLowerCase();
        if (wanted.has(extension)) {
          files.push({
            absolutePath,
            relativePath: path.relative(root, absolutePath),
            name: entry.name,
            extension
          });
        }
      }
    }
  }

  await walk(root);
  return files;
}

export function matchesTarget(file: ProjectFile, pattern: string): boolean {
  const normalizedPattern = pattern.trim().toLowerCase();
  const relative = file.relativePath.replaceAll("\\", "/").toLowerCase();
  const name = file.name.toLowerCase();
  if (!normalizedPattern) return false;
  if (normalizedPattern.includes("*")) {
    const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
    return new RegExp(`^${escaped}$`).test(name) || new RegExp(escaped).test(relative);
  }
  return name === normalizedPattern || relative.endsWith(normalizedPattern);
}
