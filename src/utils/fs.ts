import fs from 'node:fs/promises';

/**
 * Checks if a path exists
 * @param path A path to a folder or a file e.g. /path/to/my/file.png
 * @returns true if the path exists, false otherwise
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
