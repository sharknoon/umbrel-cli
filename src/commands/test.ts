import path from "node:path";
import open from "open";
import Client from "ssh2-sftp-client";
import { Client as SSHClient } from "ssh2";
import pc from "picocolors";
import { getAllAppIds } from "../modules/appstore";
import { MESSAGE_ABORTED } from "../modules/console";
import { exit } from "../modules/process";
import { connect, exec as execSSH } from "../modules/ssh";
import { getUmbrelAppYml } from "../modules/app";
import {
  cancel,
  group,
  text,
  password as passwordPrompt,
  log,
  confirm,
  isCancel,
  spinner,
  intro,
  outro,
} from "@clack/prompts";
import { exec as execCallback } from "node:child_process";
import util from "node:util";
import fs from "node:fs";

const exec = util.promisify(execCallback);

export async function test(
  cwd: string,
  appId?: string,
  host?: string,
  port?: number,
  username?: string,
  password?: string,
) {
  const appIds: string[] = await getAllAppIds(cwd);
  if (appId && !appIds.includes(appId)) {
    console.log(
      pc.red(
        `Could not find an app with the id ${pc.bold(
          appId,
        )} in the app store ${pc.bold(cwd)}`,
      ),
    );
    await exit();
    return;
  }
  host = host || "umbrel.local";
  port = port || 22;
  username = username || "umbrel";
  const sftp = new Client();

  intro(`${pc.bgBlue(pc.white(" Testing an Umbrel App "))}`);
  const result = await group(
    {
      appId: () => {
        if (!appId) {
          return text({
            message: "Please enter the id of the app to be tested:",
            placeholder: "my-cool-app",
            initialValue: appId,
            validate: (value) => {
              if (!appIds.includes(value)) {
                return `Could not find an app with the id ${pc.bold(
                  value,
                )} in the app store ${pc.bold(cwd)}`;
              }
              return undefined;
            },
          });
        } else {
          return Promise.resolve(appId);
        }
      },
    },
    {
      // On Cancel callback that wraps the group
      // So if the user cancels one of the prompts in the group this function will be called
      onCancel: async () => {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      },
    },
  );
  appId = result.appId;

  const enteredHost = await text({
    message: "Please enter the hostname of your Umbrel:",
    initialValue: host,
  });
  if (isCancel(enteredHost)) {
    cancel(MESSAGE_ABORTED);
    await exit();
    return;
  }
  host = enteredHost;

  const enteredPort = await text({
    message: "Please enter the port of your Umbrel:",
    initialValue: String(port),
  });
  if (isCancel(enteredPort)) {
    cancel(MESSAGE_ABORTED);
    await exit();
    return;
  }
  port = Number(enteredPort);

  const enteredUsername = await text({
    message: "Please enter the username for your Umbrel:",
    initialValue: username,
  });
  if (isCancel(enteredUsername)) {
    cancel(MESSAGE_ABORTED);
    await exit();
    return;
  }
  username = enteredUsername;

  if (!password) {
    const enteredPassword = await passwordPrompt({
      message: "Please enter the password for your Umbrel:",
    });
    if (isCancel(enteredPassword)) {
      cancel(MESSAGE_ABORTED);
      await exit();
      return;
    }
    password = enteredPassword;
  }

  try {
    try {
      await sftp.connect({
        host,
        port,
        username,
        password,
      });
      log.success(pc.green("🎉 Successfully connected to Umbrel"));
    } catch (err) {
      log.error(pc.red("🚨 Error connecting to Umbrel: " + err));
      cancel(
        `❗ Please check the ssh connection manually by typing ${pc.bold(pc.cyan(`ssh ${port !== 22 ? `-p ${port} ` : ""}${username}@${host}`))}.`,
      );
      return;
    }

    const appStoresDir = "/home/umbrel/umbrel/app-stores";
    const appDir = `${appStoresDir}/getumbrel-umbrel-apps-github-53f74447/${appId}`;

    // Check if the app already exists on the umbrel and ask if the user wants to override it
    if (await sftp.exists(appDir)) {
      const override = await confirm({
        message: pc.yellow(
          `⚠️ The app ${pc.bold(appId)} already exists on your Umbrel. Do you want to override it?`,
        ),
        initialValue: false,
      });
      if (isCancel(override) || !override) {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      }
      await sftp.rmdir(appDir, true);
    }

    // Copy the app to the umbrel
    const s = spinner();
    s.start(pc.cyan(`📦 Copying ${pc.bold(appId)} to ${pc.bold(appDir)}`));
    const uploadedFiles: string[] = [];
    async function uploadDirWithUnixLineEndings(
      localDir: string,
      remoteDir: string,
      filter: (path: string) => boolean,
    ) {
      const files = fs.readdirSync(localDir, { withFileTypes: true });
      await sftp.mkdir(remoteDir, true);
      for (const file of files) {
        const localPath = path.join(localDir, file.name);
        if (!filter(localPath)) {
          continue;
        }
        const remotePath = path.posix.join(remoteDir, file.name);
        if (file.isDirectory()) {
          await uploadDirWithUnixLineEndings(localPath, remotePath, filter);
        } else if (!file.name.startsWith(".")) {
          let content = fs.readFileSync(localPath, "utf8");
          content = content.replaceAll(/\r\n/g, "\n");
          await sftp.put(Buffer.from(content, "utf8"), remotePath);
          uploadedFiles.push(remotePath);
        }
      }
    }
    await uploadDirWithUnixLineEndings(
      path.join(cwd, appId),
      appDir,
      (p) => !path.basename(p).startsWith("."),
    );
    s.stop(
      pc.cyan(`📦 Copying ${pc.bold(appId)} to ${pc.bold(appDir)} ✔️`) +
        createSpinnerResult(
          uploadedFiles.map((p) => path.posix.relative(appDir, p)),
        ),
    );

    // If there are any scripts, make them executable
    s.start(pc.cyan(`🔧 Making scripts in ${pc.bold(appDir)} executable...`));
    const executableFiles: string[] = [];
    async function makeFilesExecutable(dir: string) {
      const files = await sftp.list(dir);
      for (const file of files) {
        switch (file.type) {
          case "d":
            // If the file is a directory, recursively call the function
            await makeFilesExecutable(path.posix.join(dir, file.name));
            break;
          case "-":
            // If the file is not a directory and not a link, check if it is a script
            if (file.name.endsWith(".sh") || dir.includes("hooks")) {
              await sftp.chmod(path.posix.join(dir, file.name), "755");
              executableFiles.push(path.posix.join(dir, file.name));
            }
            break;
        }
      }
    }
    await makeFilesExecutable(appDir);
    s.stop(
      pc.cyan(`🔧 Making scripts in ${pc.bold(appDir)} executable ✔️`) +
        createSpinnerResult(
          executableFiles.map((p) => path.posix.relative(appDir, p)),
        ),
    );
  } finally {
    await sftp.end();
  }

  // Open ssh connection to umbrel
  const ssh = new SSHClient();
  try {
    await connect(ssh, {
      host,
      port,
      username,
      password,
    });

    // Check if the app is already installed
    const isIntalledQueryResult = await execViaSSH(
      ssh,
      `umbreld client apps.state.query --appId ${appId}`,
    );
    let isAlreadyInstalled = false;
    if (!isIntalledQueryResult.stdout.includes("not-installed")) {
      isAlreadyInstalled = true;
    }

    // If already installed, udpate the app
    if (isAlreadyInstalled) {
      const update = await confirm({
        message: pc.yellow(
          `⚠️ The app ${pc.bold(appId)} is already installed on your Umbrel. Do you want to update it?`,
        ),
        initialValue: false,
      });
      if (isCancel(update) || !update) {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      }
      const updateResult = await execViaSSH(
        ssh,
        `umbreld client apps.update.mutate --appId ${appId}`,
      );
      if (updateResult.stdout.includes("false")) {
        log.error(
          pc.red(
            `🚨 Error updating the app! For more information visit ${pc.bold("Settings -> Troubleshoot -> umbrelOS")}`,
          ),
        );
        return;
      }
    } else {
      // Install the app
      const installResult = await execViaSSH(
        ssh,
        `umbreld client apps.install.mutate --appId ${appId}`,
      );
      if (installResult.stdout.includes("false")) {
        log.error(
          pc.red(
            `🚨 Error installing the app! For more information visit ${pc.bold("Settings -> Troubleshoot -> umbrelOS")}.`,
          ),
        );
        return;
      }
    }
  } finally {
    ssh.end();
  }

  // Open the app
  const umbrelAppYml = await getUmbrelAppYml(cwd, appId);
  const appPort = umbrelAppYml?.port;
  if (!appPort) {
    log.error(
      pc.red(
        `🚨 The app ${pc.bold(appId)} does not have a port defined in its ${pc.bold(
          "umbrel-app.yml",
        )}`,
      ),
    );
    return;
  }
  const pathname = umbrelAppYml?.path || "";
  const url = new URL(`http://${host}`);
  url.port = appPort;
  url.pathname = pathname;
  log.success(pc.green(`🚀 Opening ${pc.bold(String(url))}`));
  await open(url.toString());
  outro(
    pc.blue(
      "ℹ️ If the page does not open immediatly, please wait a few seconds and refresh the page.",
    ),
  );
}

export async function listMultipassVMs() {
  try {
    const { stdout } = await execLocally("multipass list");
    if (stdout.includes("No instances found")) {
      return [];
    }
    let lines = stdout.split("\n");
    // Remove "Name State IPv4 Image" Header
    if (lines.length > 0) {
      lines = lines.slice(1);
    }
    const vms: string[] = [];
    for (const line of lines) {
      // Skip lines which are still belonging to the same VM
      if (line.startsWith(" ") || line === "") {
        continue;
      }
      vms.push(line.split(" ")[0]);
    }
    return vms;
  } catch {
    return [];
  }
}

async function execViaSSH(client: SSHClient, command: string) {
  return _execCommon(command, async () => await execSSH(client, command));
}

async function execLocally(command: string) {
  return _execCommon(command, async () => await exec(command));
}

async function _execCommon(
  command: string,
  runnable: () => Promise<{ stdout: string; stderr: string }>,
) {
  const s = spinner();
  let formattedCommand = command;
  // If the command is too long for the terminal window, shorten it to prevent muiltiple lines printed.
  // Only the current line is being deleted for the spinner, therefore is should never exceed one line.
  // 15 = "◇  🏃 Executing "
  // 3 = "..."
  // 1 = buffer to prevent the last emoji (✔️) from being cut off
  if (15 + formattedCommand.length + 3 + 1 > process.stdout.columns) {
    formattedCommand =
      formattedCommand.slice(0, process.stdout.columns - 15 - 3 - 1 - 3) +
      "...";
  }
  s.start(pc.cyan(`🏃 Executing ${pc.bold(formattedCommand)}`));

  const result = await runnable();

  const output = result.stdout || result.stderr;
  const lines = output.split("\n");
  const spinnerResult = createSpinnerResult(lines);

  s.stop(
    `${pc.cyan(`🏃 Executing ${pc.bold(formattedCommand)} ✔️`)}${spinnerResult}`,
  );
  return result;
}

function createSpinnerResult(lines: string[]) {
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return pc.gray("\n│  " + lines.join("\n│  "));
}
