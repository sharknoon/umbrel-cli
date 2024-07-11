import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Entry } from "../lib";

/**
 * Checks if a path exists
 *
 * @param path A path to a folder or a file e.g. /path/to/my/file.png
 * @returns true if the path exists, false otherwise
 */
export async function exists(...path: string[]): Promise<boolean> {
  try {
    await fs.access(resolve(...path), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a list of all files and directories in the dir directory
 * @param dir The directory to walk from
 * @returns A list of all files and directories with their type
 */
export async function readDirRecursive(dir: string): Promise<Entry[]> {
  dir = resolve(dir);
  const rawFileList = await fs.readdir(dir, {
    recursive: true,
    withFileTypes: true,
  });
  const fileList = rawFileList
    .filter((f) => f.isDirectory() || f.isFile())
    .map((f) => ({
      path: path
        .relative(dir, path.resolve(f.parentPath, f.name))
        .split(path.sep)
        .join(path.posix.sep),
      type: (f.isDirectory() ? "directory" : "file") as "file" | "directory",
    }));
  return fileList;
}

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);
