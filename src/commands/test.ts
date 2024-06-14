import path from "node:path";
import open from "open";
import { read } from "read";
import Client from "ssh2-sftp-client";
import { Client as SSHClient } from "ssh2";
import pc from "picocolors";
import { getAllAppIds } from "../modules/appstore";
import { MESSAGE_ABORTED, printAborted } from "../modules/console";
import { exit } from "../modules/process";
import { connect, exec } from "../modules/ssh";
import { getAppYml } from "../modules/app";

export async function test(cwd: string, id: string, host: string) {
  const appIds: string[] = await getAllAppIds(cwd);
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

  const sftp = new Client();
  try {
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
      console.error(
        pc.red(
          pc.bold(
            `🚨 Please check the ssh connection manually by typing ${pc.cyan(`ssh umbrel@${host}`)}.`
          )
        )
      );
      return;
    }

    let environment: "development" | "production";
    let appStoresDir = "/home/umbrel/umbrel";
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

    const appDir = `${appStoresDir}/getumbrel-umbrel-apps-github-53f74447/${appId}`;

    if (await sftp.exists(appDir)) {
      const override = await read({
        prompt: pc.yellow(
          `⚠️ The app ${pc.bold(appId)} already exists on your Umbrel. Do you want to override it? (Y/n)`
        ),
      });
      if (override === "" || override.toLowerCase() === "y") {
        await sftp.rmdir(appDir, true);
      } else {
        console.log(MESSAGE_ABORTED);
        return;
      }
    }

    console.log(pc.cyan(`📦 Copying ${pc.bold(appId)} to ${pc.bold(appDir)}`));
    await sftp.uploadDir(path.join(cwd, appId), appDir, {
      filter: (p) => !path.basename(p).startsWith("."),
    });
  } finally {
    await sftp.end();
  }

  // Open ssh connection to umbrel
  const ssh = new SSHClient();
  try {
    await connect(ssh, {
      host,
      port: 22,
      username: "umbrel",
      password,
    });

    // Check if the app is already installed
    console.log(
      pc.cyan(
        `🏃 Executing ${pc.bold(`umbreld client apps.state.query --appId ${appId}`)}`
      )
    );
    const result = await exec(
      ssh,
      `umbreld client apps.state.query --appId ${appId}`
    );
    let isAlreadyInstalled = false;
    try {
      if (!result.result.includes("not-installed")) {
        isAlreadyInstalled = true;
      }
    } catch (err) {
      console.error(
        pc.red(
          pc.bold("🚨 Error checking if the app was already installed: ")
        ) + err
      );
      return;
    }

    // If necessary, uninstall the app
    if (isAlreadyInstalled) {
      const reinstall = await read({
        prompt: pc.yellow(
          `⚠️ The app ${pc.bold(appId)} is already installed on your Umbrel. Do you want to reinstall it? (Y/n)`
        ),
      });
      if (reinstall !== "" && reinstall.toLowerCase() !== "y") {
        console.log(MESSAGE_ABORTED);
        return;
      }
      console.log(
        pc.cyan(
          `🏃 Executing ${pc.bold(`umbreld client apps.uninstall.mutate --appId ${appId}`)}`
        )
      );
      await exec(ssh, `umbreld client apps.uninstall.mutate --appId ${appId}`);
    }

    // Install the app
    console.log(
      pc.cyan(
        `🏃 Executing ${pc.bold(`umbreld client apps.install.mutate --appId ${appId}`)}`
      )
    );
    await exec(ssh, `umbreld client apps.install.mutate --appId ${appId}`);
  } finally {
    ssh.end();
  }

  // Open the app
  const umbrelAppYml = await getAppYml(cwd, appId);
  const port = umbrelAppYml?.port;
  if (!port) {
    console.error(
      pc.red(
        `🚨 The app ${pc.bold(appId)} does not have a port defined in its ${pc.bold(
          "umbrel-app.yml"
        )}`
      )
    );
    return;
  }
  const pathname = umbrelAppYml?.path || "";
  const url = new URL(`http://${host}`);
  url.port = port;
  url.pathname = pathname;
  console.log(pc.green(`🚀 Opening ${pc.bold(String(url))}`));
  await open(url.toString());
  console.log(
    pc.blue(
      "ℹ️ If the page does not open immediatly, please wait a few seconds and refresh the page."
    )
  );
}
