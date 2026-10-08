import fs from "node:fs/promises";

export interface JavaSourceInfo {
  packageName?: string;
  publicClassName?: string;
  hasMainMethod: boolean;
  fullyQualifiedClassName?: string;
  sourceCode: string;
}

export async function parseJavaSource(filePath: string): Promise<JavaSourceInfo> {
  const sourceCode = await fs.readFile(filePath, "utf8");
  const withoutComments = sourceCode
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const packageName = withoutComments.match(/\bpackage\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/)?.[1];
  const publicClassName = withoutComments.match(/\bpublic\s+class\s+([A-Za-z_$][\w$]*)\b/)?.[1];
  const fallbackClassName = withoutComments.match(/\bclass\s+([A-Za-z_$][\w$]*)\b/)?.[1];
  const className = publicClassName ?? fallbackClassName;
  const hasMainMethod = /\bpublic\s+static\s+void\s+main\s*\(\s*(?:final\s+)?String\s*(?:(?:\[\s*\]\s*|\.\.\.\s*)[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*\s*\[\s*\])\s*\)/.test(withoutComments);

  return {
    packageName,
    publicClassName: className,
    hasMainMethod,
    fullyQualifiedClassName: className ? [packageName, className].filter(Boolean).join(".") : undefined,
    sourceCode
  };
}
