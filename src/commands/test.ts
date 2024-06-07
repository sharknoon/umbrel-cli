import path from "node:path";
import { read } from "read";
import Client from "ssh2-sftp-client";
import pc from "picocolors";
import { getAppIds, getUmbrelAppStoreYml } from "../modules/appstore";
import { printAborted } from "../modules/console";
import { exit } from "../modules/process";

export async function test(cwd: string, id: string, host: string) {
  let appIds: string[] = await getAppIds(cwd);
  let appId: string = id;
  let password: string;

  try {
    if (!appId) {
      appId = await read({
        prompt: "Please enter the id of the app to be tested: ",
      });
    }

    if (!appIds.includes(appId)) {
      console.error(
        pc.red(
          `Could not find an app with the id ${pc.bold(
            appId
          )} in the app store ${pc.bold(cwd)}`
        )
      );
      return;
    }

    password = await read({
      prompt: "Please enter the password for your Umbrel: ",
      silent: true,
      replace: "*",
    });
  } catch {
    printAborted();
    await exit();
    return;
  }

  let sftp = new Client();

  try {
    await sftp.connect({
      host,
      port: 22,
      username: "umbrel",
      password,
    });
    console.log(pc.green("🎉 Successfully connected to Umbrel"));
  } catch (err) {
    console.error(pc.red(pc.bold("🚨 Error connecting to Umbrel: ")) + err);
    return;
  }

  let environment: "development" | "production";
  let appStoresDir: string = "/home/umbrel/umbrel";
  if (await sftp.exists(appStoresDir + "/app-stores")) {
    environment = "production";
    appStoresDir += "/app-stores";
  } else if (
    await sftp.exists(appStoresDir + "/packages/umbreld/data/app-stores")
  ) {
    environment = "development";
    appStoresDir += "/packages/umbreld/data/app-stores";
  } else {
    console.error(
      pc.red(
        pc.bold(
          `🚨 Could not find the ${pc.cyan("app-stores")} directory on your Umbrel`
        )
      )
    );
    return;
  }

  console.log("Umbrel OS environment: " + pc.cyan(environment));

  // TODO handle case for community app stores
  const appDir = `${appStoresDir}/getumbrel-umbrel-apps-github-53f74447/${appId}`;

  console.log(pc.cyan(`📦 Copying ${pc.bold(appId)} to ${pc.bold(appDir)}`));
  await sftp.uploadDir(path.join(cwd, appId), appDir, {
    filter: (p) => !path.basename(p).startsWith("."),
  });

  await sftp.end();
}
