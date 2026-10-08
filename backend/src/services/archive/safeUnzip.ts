import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";
import { decodeZipEntryPath } from "../../utils/fileNameEncoding.js";

const DEFAULT_MAX_BYTES = 80 * 1024 * 1024;

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function safeUnzip(zipPath: string, destination: string, maxBytes = DEFAULT_MAX_BYTES): Promise<void> {
  await fsp.mkdir(destination, { recursive: true });
  const directory = await unzipper.Open.file(zipPath);
  let total = 0;

  for (const entry of directory.files) {
    const entryPath = decodeZipEntryPath(entry);
    const normalized = path.normalize(entryPath);
    if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
      throw new Error(`Unsafe ZIP entry path: ${entryPath}`);
    }
    total += entry.uncompressedSize || 0;
    if (total > maxBytes) {
      throw new Error(`ZIP extraction limit exceeded: ${maxBytes} bytes`);
    }
  }

  for (const entry of directory.files) {
    const entryPath = decodeZipEntryPath(entry);
    const target = path.resolve(destination, entryPath);
    if (!isInside(destination, target)) {
      throw new Error(`ZIP slip blocked: ${entryPath}`);
    }
    if (entry.type === "Directory") {
      await fsp.mkdir(target, { recursive: true });
      continue;
    }
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      entry
        .stream()
        .pipe(fs.createWriteStream(target, { flags: "wx" }))
        .on("finish", resolve)
        .on("error", reject);
    });
  }
}
