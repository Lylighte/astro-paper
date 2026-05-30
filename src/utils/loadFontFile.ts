import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadFontFile(fileName: string) {
  const fontPath = path.join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans-sc",
    "files",
    fileName
  );

  return readFile(fontPath);
}