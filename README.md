# Umbrel CLI

This is a small CLI tool to help you create and manage your [Umbrel](https://umbrel.com) apps.

## Get started

```bash
npm install -g umbrel-cli
umbrel create app
```

## Features

- 🛍️ Support for the official Umbrel App Store as well as Community App Stores
- 🗺️ Guides you through the creation of an app (not yet finished)

## Roadmap

- [x] 🛍️ Creating a Community App Store / cloning the official Umbrel App Store
- [ ] 🗺️ Creating an app
- [ ] ⬇️ Updating an app
- [ ] 🧪 App testing using `umbrel test <appid>`

## Run Umbrel OS

Prerequisites:

- [Multipass](https://multipass.run/install)

This method diviates from the official installation method in that it clones the repository inside the vm
instead of on the machine. This is necessary to ensure that in windows the correct +x flags are set and the
line breaks (\n instead of \r\n) are correct.

```bash
# Feel free to up the specs
multipass launch --name umbrel-dev --cpus 4 --memory 8G --disk 50G 23.10
# Fake the mount directory by creating it manually
multipass exec umbrel-dev -- sudo mkdir /opt/umbrel-mount
multipass exec umbrel-dev -- sudo chown ubuntu:ubuntu /opt/umbrel-mount
# Cloning instead of mounting ensures the correct +x flags are set and the line breaks (\n instead of \r\n) are correct
multipass exec umbrel-dev -- git clone https://github.com/getumbrel/umbrel.git /opt/umbrel-mount
multipass exec umbrel-dev -- /opt/umbrel-mount/scripts/vm provision
```
