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
  select,
  text,
  password as passwordPrompt,
  log,
  confirm,
  isCancel,
  spinner,
  intro,
  outro,
  note,
} from "@clack/prompts";
import { exec as execCallback } from "node:child_process";
import util from "node:util";

const exec = util.promisify(execCallback);

export async function test(
  cwd: string,
  appId?: string,
  host?: string,
  port?: number,
  username?: string,
  password?: string
) {
  const appIds: string[] = await getAllAppIds(cwd);
  if (appId && !appIds.includes(appId)) {
    console.log(
      pc.red(
        `Could not find an app with the id ${pc.bold(
          appId
        )} in the app store ${pc.bold(cwd)}`
      )
    );
    await exit();
    return;
  }
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
                  value
                )} in the app store ${pc.bold(cwd)}`;
              }
              return undefined;
            },
          });
        } else {
          return Promise.resolve(appId);
        }
      },
      environment: () =>
        select({
          message: "Where does your umbrelOS run?",
          initialValue: "prod",
          options: [
            {
              value: "prod",
              label:
                "Umbrel Home, Raspberry Pi, any x86 system, Proxmox, etc...",
            },
            { value: "dev", label: "Multipass Development VM" },
          ],
        }),
    },
    {
      // On Cancel callback that wraps the group
      // So if the user cancels one of the prompts in the group this function will be called
      onCancel: async () => {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      },
    }
  );
  appId = result.appId;
  const environment = result.environment;

  if (environment === "prod") {
    log.info(
      pc.blue(
        `ℹ️ Connecting to ${pc.bold(`${host}:${port}`)} as ${pc.bold(username)}`
      )
    );

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
          `❗ Please check the ssh connection manually by typing ${pc.bold(pc.cyan(`ssh ${port !== 22 ? `-p ${port} ` : ""}${username}@${host}`))}.`
        );
        return;
      }

      const appStoresDir = "/home/umbrel/umbrel/app-stores";
      const appDir = `${appStoresDir}/getumbrel-umbrel-apps-github-53f74447/${appId}`;

      // Check if the app already exists on the umbrel and ask if the user wants to override it
      if (await sftp.exists(appDir)) {
        const override = await confirm({
          message: pc.yellow(
            `⚠️ The app ${pc.bold(appId)} already exists on your Umbrel. Do you want to override it?`
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
      await sftp.uploadDir(path.join(cwd, appId), appDir, {
        filter: (p) => !path.basename(p).startsWith("."),
      });
      s.stop(pc.cyan(`📦 Copying ${pc.bold(appId)} to ${pc.bold(appDir)} ✔️`));
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
        `umbreld client apps.state.query --appId ${appId}`
      );
      let isAlreadyInstalled = false;
      if (!isIntalledQueryResult.stdout.includes("not-installed")) {
        isAlreadyInstalled = true;
      }

      // If necessary, uninstall the app
      if (isAlreadyInstalled) {
        const reinstall = await confirm({
          message: pc.yellow(
            `⚠️ The app ${pc.bold(appId)} is already installed on your Umbrel. Do you want to reinstall it?`
          ),
          initialValue: false,
        });
        if (isCancel(reinstall) || !reinstall) {
          cancel(MESSAGE_ABORTED);
          await exit();
          return;
        }
        const uninstallResult = await execViaSSH(
          ssh,
          `umbreld client apps.uninstall.mutate --appId ${appId}`
        );
        if (uninstallResult.stdout.includes("false")) {
          log.error(
            pc.red(
              `🚨 Error uninstalling the app! For more information visit ${pc.bold("Settings -> Troubleshoot -> umbrelOS")}`
            )
          );
          return;
        }
      }

      // Install the app
      const installResult = await execViaSSH(
        ssh,
        `umbreld client apps.install.mutate --appId ${appId}`
      );
      if (installResult.stdout.includes("false")) {
        log.error(
          pc.red(
            `🚨 Error installing the app! For more information visit ${pc.bold("Settings -> Troubleshoot -> umbrelOS")}.`
          )
        );
        return;
      }
    } finally {
      ssh.end();
    }
  } else {
    // Dev environment
    const appStoreLocation =
      "/home/ubuntu/umbrel/packages/umbreld/data/app-stores/getumbrel-umbrel-apps-github-53f74447";

    // Check if multipass is installed
    try {
      await execLocally("multipass --version");
    } catch {
      cancel(
        pc.red(
          "🚨 Multipass is not installed on your system. Please install it and try again."
        )
      );
      await exit();
      return;
    }

    // Select the Multipass VM to use
    const vms = await listMultipassVMs();
    let vm: string;
    if (vms.length === 0) {
      note(
        `multipass launch --name umbrel-dev --cpus 4 --memory 8G --disk 50G 23.10
multipass exec umbrel-dev -- sudo mkdir /opt/umbrel-mount
multipass exec umbrel-dev -- sudo chown ubuntu:ubuntu /opt/umbrel-mount
multipass exec umbrel-dev -- git clone https://github.com/getumbrel/umbrel.git /opt/umbrel-mount
multipass exec umbrel-dev -- /opt/umbrel-mount/scripts/vm provision`,
        pc.blue("You can create a VM by running:")
      );
      cancel(
        pc.red(
          "🚨 No VMs found. Please create a VM using Multipass and try again."
        )
      );
      await exit();
      return;
    } else if (vms.length === 1) {
      vm = vms[0];
      host = `${vm}.local`;
      log.info(pc.blue(`ℹ️ Using Multipass VM ${pc.bold(vm)}`));
    } else {
      const selection = await select({
        message: "Multiple Multipass VMs found! Please select the VM to use:",
        options: vms.map((vm) => ({ value: vm, label: vm })),
        initialValue: vms[0],
      });
      if (isCancel(selection)) {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      }
      vm = selection;
    }

    // Check if the app already exists on the umbrel and ask if the user wants to override it
    let appAlreadyExists;
    try {
      await execLocally(
        `multipass exec ${vm} -- ls ${appStoreLocation}/${appId}`
      );
      appAlreadyExists = true;
    } catch {
      appAlreadyExists = false;
    }

    if (appAlreadyExists) {
      const override = await confirm({
        message: pc.yellow(
          `⚠️ The app ${pc.bold(appId)} already exists on your Umbrel. Do you want to override it?`
        ),
        initialValue: false,
      });
      if (isCancel(override) || !override) {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      }
      await execLocally(
        `multipass exec ${vm} -- rm -rf ${appStoreLocation}/${appId}`
      );
    }

    // Copy the app to the umbrel
    await execLocally(
      `multipass transfer -r ${path.join(cwd, appId)} ${vm}:${appStoreLocation}`
    );

    // Check if the app is already installed
    let isAlreadyInstalled = false;
    try {
      const result = await execLocally(
        `multipass exec ${vm} -- UMBREL_DATA_DIR=./data UMBREL_TRPC_ENDPOINT=http://localhost/trpc npm --prefix /home/ubuntu/umbrel/packages/umbreld run start -- client apps.state.query --appId ${appId}`
      );
      if (result.stdout.includes("not-installed")) {
        isAlreadyInstalled = false;
      } else {
        isAlreadyInstalled = true;
      }
    } catch (err) {
      log.error(
        pc.red(
          pc.bold("🚨 Error checking if the app was already installed: ") + err
        )
      );
      return;
    }
    if (isAlreadyInstalled) {
      const reinstall = await confirm({
        message: pc.yellow(
          `⚠️ The app ${pc.bold(appId)} is already installed on your Multipass VM. Do you want to reinstall it?`
        ),
        initialValue: false,
      });
      if (isCancel(reinstall) || !reinstall) {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      }
      await execLocally(
        `multipass exec ${vm} -- UMBREL_DATA_DIR=./data UMBREL_TRPC_ENDPOINT=http://localhost/trpc npm --prefix /home/ubuntu/umbrel/packages/umbreld run start -- client apps.uninstall.mutate --appId ${appId}`
      );
    }

    // Install the app
    await execLocally(
      `multipass exec ${vm} -- UMBREL_DATA_DIR=./data UMBREL_TRPC_ENDPOINT=http://localhost/trpc npm --prefix /home/ubuntu/umbrel/packages/umbreld run start -- client apps.install.mutate --appId ${appId}`
    );
  }

  // Open the app
  const umbrelAppYml = await getUmbrelAppYml(cwd, appId);
  const appPort = umbrelAppYml?.port;
  if (!appPort) {
    log.error(
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
  url.port = appPort;
  url.pathname = pathname;
  log.success(pc.green(`🚀 Opening ${pc.bold(String(url))}`));
  await open(url.toString());
  outro(
    pc.blue(
      "ℹ️ If the page does not open immediatly, please wait a few seconds and refresh the page."
    )
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
  runnable: () => Promise<{ stdout: string; stderr: string }>
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
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  const formattedOutput = pc.gray("\n│  " + lines.join("\n│  "));

  s.stop(
    `${pc.cyan(`🏃 Executing ${pc.bold(formattedCommand)} ✔️`)}${formattedOutput}`
  );
  return result;
}
