import { TextDecoder } from "node:util";

const eucKrDecoder = new TextDecoder("euc-kr", { fatal: false });

export function repairUploadedFileName(fileName: string): string {
  if (!looksBroken(fileName)) return fileName;
  const repaired = Buffer.from(fileName, "latin1").toString("utf8");
  return looksBetter(repaired, fileName) ? repaired : fileName;
}

export function decodeZipEntryPath(entry: { path: string; pathBuffer?: Buffer; isUnicode?: boolean }): string {
  if (!entry.pathBuffer || entry.isUnicode) return entry.path;
  if (!looksBroken(entry.path)) return entry.path;
  const repaired = eucKrDecoder.decode(entry.pathBuffer);
  return looksBetter(repaired, entry.path) ? repaired : entry.path;
}

function looksBroken(value: string): boolean {
  return value.includes("\uFFFD") || /(?:Ã|Â|ì|í|ê|ë|ã|ä|å|ð|þ)/.test(value);
}

function looksBetter(candidate: string, original: string): boolean {
  return scoreReadable(candidate) > scoreReadable(original);
}

function scoreReadable(value: string): number {
  const replacement = (value.match(/\uFFFD/g) ?? []).length;
  const hangul = (value.match(/[가-힣]/g) ?? []).length;
  const ascii = (value.match(/[A-Za-z0-9._\-()/\s]/g) ?? []).length;
  const mojibake = (value.match(/[ÃÂìíêëãäåðþ]/g) ?? []).length;
  return hangul * 3 + ascii - replacement * 10 - mojibake * 2;
}
