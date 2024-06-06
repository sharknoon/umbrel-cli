import semver from "semver";
import packageJson from "../../package.json";
import getLatestVersion from "latest-version";
import pc from "picocolors";

export async function exit(code = 0): Promise<never> {
  await checkForUpdate();
  process.exit(code);
}

async function checkForUpdate() {
  const currentVersion = packageJson.version;
  const latestVersion = await getLatestVersion(packageJson.name);
  const updateAvailable = semver.gt(latestVersion, currentVersion);
  if (updateAvailable) {
    console.log();
    console.log(
      `  New version available! ${pc.gray(`(${currentVersion} -> ${latestVersion})`)}`
    );
    console.log(`  Update with ${pc.cyan(pc.bold("npm update -g umbrel-cli"))}`);
    console.log();
  }
}
