import nodepath from "node:path";
import fs from "node:fs/promises";
import http from "isomorphic-git/http/node";
import { exists } from "./fs";
import { clone, pull } from "isomorphic-git";

/**
 * Clones a repository from the specified remote URL if it doesn't exist,
 * or pulls the latest changes if the repository already exists.
 *
 * @param path - The local path where the repository will be cloned or pulled.
 * @param gitRemoteUrl - The URL of the remote Git repository.
 */
export async function cloneOrPullRepository(
  path: string,
  gitRemoteUrl: string
) {
  let repoExists = await exists(nodepath.join(path, ".git"));
  if (repoExists) {
    try {
      await pull({ fs, http, dir: path, author: { name: "Umbrel CLI" } });
    } catch (e) {
      // In case the repository contents were altered and the pull fails, we need to remove the directory before cloning again
      await fs.rm(path, { recursive: true, force: true });
      repoExists = false;
    }
  }
  if (!repoExists) {
    await clone({
      fs,
      http,
      dir: path,
      url: gitRemoteUrl,
    });
  }
}
