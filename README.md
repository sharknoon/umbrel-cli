# umbrelCLI

[![Node.js CI](https://github.com/sharknoon/umbrel-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/sharknoon/umbrel-cli/actions/workflows/ci.yml)

This is a small CLI tool to help you create and manage your own [Umbrel](https://umbrel.com) apps.

## Get started

```bash
npm install -g umbrel-cli@latest
umbrel --help
```

## Features

- 🛍️ Support for the official Umbrel App Store as well as Community App Stores
- 🗺️ Guides you through the creation of an app or an Community App Store
- 🕵️ Finds errors in your app manifests and compose files early
- ⬆️ Uploads your app to your Umbrel to quickly test it

## Documentation

### `umbrel appstore create <name>`

This command initializes an App Store.

`<name>` is an optional name for the App Store directory. When left empty, you get asked to provide one.

![umbrel appstore create](assets/appstore-create.svg?raw=true)

### `umbrel app create <name>`

> [!NOTE]  
> This command can only be executed inside an App Store directory!

This command scaffoldes a new app. It needs to be invoked from inside an App Store directory.

`<name>` is an optional name for the app directory. When left empty, you get asked to provide one.

![umbrel app create](assets/app-create.svg?raw=true)

### `umbrel lint <name>`

> [!NOTE]  
> This command can only be executed inside an App Store directory!

This command checkes your App Store and all Apps inside it for potential errors.

If `<name>` is specified, the linter only lints the specified app. When left empty, all apps get linted.

These files are being checked:

- Validity of `umbrel-app-store.yml`
- Existence of `README.me`
- Validity of `<app>/umbrel-app.yml`
- Validity of `<app>/docker-compose.yml`
- Existence of `.gitkeep` files in empty directories
- (WIP) Validity of `<app>/exports.sh`

![umbrel lint](assets/lint.svg?raw=true)

### `umbrel port generate`

This command generates a new and not yet used port to be used inside one of your apps.
It checks against the ports from the official App Store and when executed from a Community App Store,
also against those ports.

![umbrel port generate](assets/port-generate.svg?raw=true)

### `umbrel test <name>`

> [!NOTE]  
> This command can only be executed inside an App Store directory!

#### Options

| Option             | Description                                       | Default        |
| ------------------ | ------------------------------------------------- | -------------- |
| `-H`, `--host`     | Changes the host of your umbrel to connect to     | `umbrel.local` |
| `-P`, `--port`     | Changes the port of your umbrel to connect to     | `22`           |
| `-u`, `--username` | Changes the username of your umbrel to connect to | `umbrel`       |
| `-p`, `--password` | Sets the password of your umbrel to connect to    | -              |

This command connects to your umbrel and installs the app there. If the app is already installed,
or a older version of the app is already present in the app store, it asks you if you would like
to overwrite it.

TODO screenshot

## Roadmap

- [x] 🛍️ Creating a Community App Store / cloning the official Umbrel App Store
- [x] 🗺️ Creating an app
- [ ] ⬇️ Creating an update an app
- [x] 🕵️ Linting apps and appstores
- [x] 🧪 Testing an app

## Run Umbrel OS

To test your Umbrel apps, you need to have a running Umbrel. You can either buy an [Umbrel Home](https://umbrel.com/umbrel-home),
[install it on a Raspberry Pi 4](https://github.com/getumbrel/umbrel/wiki/Raspberry-Pi-5-%E2%80%90-Boot-from-NVMe-or-USB) or newer
(min. 4GB RAM) or on any [x86 computer](https://github.com/getumbrel/umbrel/wiki/Install-umbrelOS-on-x86-systems) or
[install it in a virtual machine](https://github.com/getumbrel/umbrel/wiki/Install-umbrelOS-on-a-Linux-VM).

## Library mode

You can use some parts of this CLI programatically.

- `umbrel lint`:

  ```typescript
  import {
    lintUmbrelAppYml,
    lintUmbrelAppStoreYml,
    lintDockerComposeYml,
    lintDirectoryStructure,
  } from "umbrel-cli/dist/lib.js";
  import fs from "node:fs/promises";

  const result = await lintUmbrelAppYml(
    await fs.readFile("path/to/umbrel-app.yml"),
  );
  console.log(result);
  ```

> [!TIP]
> Please let me know via a GitHub Issue, if you want to see more CLI functions made accessible this way

## Development

To build and run the Umbrel CLI, simply clone this repository and run the following commands:

```bash
npm install
npm run dev -- -- --help
```

## Set up umbrelOS development instance

Using Multipass, you can easily and quickly set up umbrelOS for testing your apps and playing around. Keep in mind, that this
version of umbrelOS is not intended to be used in a production environment, as it may contain additional bugs!

Prerequisites:

- [Multipass](https://multipass.run/install)

This method diviates from the
[official installation method](https://github.com/getumbrel/umbrel-apps?tab=readme-ov-file#3-testing-the-app-on-umbrel)
in that it clones the repository inside the vm instead of on the machine. This is necessary to ensure that in Windows the
correct +x flags are set and the line breaks (\n instead of \r\n) are correct.

```bash
# Feel free to bump the specs
multipass launch --name umbrel-dev --cpus 4 --memory 8G --disk 50G 23.10
# Fake the mount directory by creating it manually
multipass exec umbrel-dev -- sudo mkdir /opt/umbrel-mount
multipass exec umbrel-dev -- sudo chown ubuntu:ubuntu /opt/umbrel-mount
# Cloning instead of mounting ensures the correct +x flags are set and the line breaks (\n instead of \r\n) are correct
multipass exec umbrel-dev -- git clone https://github.com/getumbrel/umbrel.git /opt/umbrel-mount
multipass exec umbrel-dev -- /opt/umbrel-mount/scripts/vm provision
```

## Record those fancy CLI screenrecordings

Prerequisites:

- [termsvg](https://github.com/MrMarble/termsvg)

```bash
# Start the recording, stop the recording by exiting the terminal with "exit"
termsvg rec <command>.cast
# Convert the .cast to .svg
termsvg export <command>.cast
```
