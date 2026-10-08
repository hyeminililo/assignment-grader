declare module "unzipper" {
  import type { Readable } from "node:stream";

  export interface ZipEntry {
    path: string;
    pathBuffer?: Buffer;
    isUnicode?: boolean;
    type: "File" | "Directory";
    uncompressedSize: number;
    stream(): Readable;
  }

  export const Open: {
    file(path: string): Promise<{ files: ZipEntry[] }>;
  };
}
