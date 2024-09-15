import { describe, expect, it } from "vitest";
import {
  lintUmbrelAppStoreYml,
  LintingResult,
  lintUmbrelAppYml,
  lintDockerComposeYml,
  Entry,
  lintDirectoryStructure,
} from "./lint";

describe("lintUmbrelAppStoreYml", () => {
  it("should return an empty array for a valid YAML file", async () => {
    const content = `
id: "sparkles"
name: "Sparkles"
    `;
    const results = await lintUmbrelAppStoreYml(content);
    expect(results).toEqual([]);
  });

  it("should return an error for an invalid YAML file", async () => {
    const content = `
id: "sparkles"
  name: "Sparkles"
    `;
    const results = await lintUmbrelAppStoreYml(content);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_yaml_syntax",
      severity: "error",
      title: "umbrel-app-store.yml is not a valid YAML file",
      message: expect.any(String),
      file: "umbrel-app-store.yml",
    });
  });

  it("should return an error for not matching the schema", async () => {
    const content = `
id: "umbrel-app-store-sparkles"
    `;
    const results = await lintUmbrelAppStoreYml(content);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_type",
      severity: "error",
      title: "name",
      message: 'The "name" key is required',
      file: "umbrel-app-store.yml",
    });
    expect(results[1]).toMatchObject<LintingResult>({
      id: "custom",
      severity: "error",
      title: "id",
      message:
        "The id of the app can't start with 'umbrel-app-store' as it is the id of the official Umbrel App Store.",
      file: "umbrel-app-store.yml",
    });
  });
});

describe("lintUmbrelAppYml", () => {
  it("should return an empty array for a valid YAML file", async () => {
    const content = `
manifestVersion: 1
id: "sparkles"
name: "Sparkles"
tagline: "The best app ever"
category: "files"
version: "1.0.0"
port: 3000
description: "This is the best app ever"
website: "https://sparkles.app"
support: "https://sparkles.app/support"
gallery: []
releaseNotes: ""
dependencies: []
path: ""
developer: "Sparkles Inc."
submitter: "John Doe"
repo: "http://github.com/sparkles/sparkles"
submission: "https://github.com/user/repo/pull/123"
    `;
    const id = "umbrel-app";
    const options = {
      isNewAppSubmission: true,
      pullRequestUrl: "https://github.com/user/repo/pull/123",
    };
    const results = await lintUmbrelAppYml(content, id, options);
    expect(results).toEqual([]);
  });

  it("should return an error for an invalid YAML file", async () => {
    const content = `
manifestVersion: 1
  id: "sparkles"
name: "Sparkles"
tagline: "The best app ever"
category: "files"
version: "1.0.0"
port: 3000
description: "This is the best app ever"
website: "https://sparkles.app"
support: "https://sparkles.app/support"
gallery: []
releaseNotes: ""
dependencies: []
path: ""
developer: "Sparkles Inc."
submitter: "John Doe"
repo: "http://github.com/sparkles/sparkles"
submission: "https://github.com/user/repo/pull/123"
    `;
    const id = "umbrel-app";
    const results = await lintUmbrelAppYml(content, id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_yaml_syntax",
      severity: "error",
      title: "umbrel-app.yml is not a valid YAML file",
      message: expect.any(String),
      file: "umbrel-app/umbrel-app.yml",
    });
  });

  it("should return an error for an invalid submission field", async () => {
    const content = `
manifestVersion: 1
id: "sparkles"
name: "Sparkles"
tagline: "The best app ever"
category: "files"
version: "1.0.0"
port: 3000
description: "This is the best app ever"
website: "https://sparkles.app"
support: "https://sparkles.app/support"
gallery: []
releaseNotes: ""
dependencies: []
path: ""
developer: "Sparkles Inc."
submitter: "John Doe"
repo: "http://github.com/sparkles/sparkles"
submission: "blaa"
    `;
    const id = "umbrel-app";
    const options = {
      isNewAppSubmission: true,
      pullRequestUrl: "https://github.com/user/repo/pull/456",
    };
    const results = await lintUmbrelAppYml(content, id, options);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject<LintingResult>({
      file: "umbrel-app/umbrel-app.yml",
      id: "invalid_string",
      message: "Invalid url",
      severity: "error",
      title: "submission",
    });
    expect(results[1]).toMatchObject<LintingResult>({
      file: "umbrel-app/umbrel-app.yml",
      id: "invalid_submission_field",
      message:
        "The submission field must be set to the URL of this pull request: https://github.com/user/repo/pull/456",
      severity: "error",
      title: 'Invalid submission field "blaa"',
    });
  });

  it("should return an error for filled out release notes on first submission", async () => {
    const content = `
manifestVersion: 1
id: "sparkles"
name: "Sparkles"
tagline: "The best app ever"
category: "files"
version: "1.0.0"
port: 3000
description: "This is the best app ever"
website: "https://sparkles.app"
support: "https://sparkles.app/support"
gallery: []
releaseNotes: "Some release notes"
dependencies: []
path: ""
developer: "Sparkles Inc."
submitter: "John Doe"
repo: "http://github.com/sparkles/sparkles"
submission: "https://github.com/user/repo/pull/123"
    `;
    const id = "umbrel-app";
    const options = {
      isNewAppSubmission: true,
      pullRequestUrl: "https://github.com/user/repo/pull/123",
    };
    const results = await lintUmbrelAppYml(content, id, options);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      file: `${id}/umbrel-app.yml`,
      id: "filled_out_release_notes_on_first_submission",
      message:
        'The "releaseNotes" field must be empty for new app submissions as it is being displayed to the user only in case of an update.',
      severity: "error",
      title: '"releaseNotes" needs to be empty for new app submissions',
    });
  });
});

describe("lintDockerComposeYml", () => {
  it("should return no errors for a valid YAML file", async () => {
    const content = `
version: "3.7"

services:
  app_proxy:
    environment:
      APP_HOST: file-browser_server_1
      APP_PORT: 80

  server:
    image: filebrowser/filebrowser:v2.30.0@sha256:862a8f4f4829cb2747ced869aea8593204bbc718c92f0f11c97e7b669a54b53d
    user: "1000:1000"
    restart: on-failure
    volumes:
      - \${APP_DATA_DIR}/data/filebrowser.db:/database/filebrowser
      - \${UMBREL_ROOT}/data/storage:/data
    environment:
      - FB_PORT=80
      - FB_DATABASE=/database/filebrowser.db
      - FB_ROOT=/data
      - FB_NOAUTH=true
`;
    const id = "file-browser";
    const files: Entry[] = [];
    const options = { checkImageArchitectures: true };
    const results = await lintDockerComposeYml(content, id, files, options);
    expect(results.filter((r) => r.severity === "error")).toEqual([]);
  });

  it("should return an error for an invalid YAML file", async () => {
    const content = `
version: "3"
  services:
    app:
      image: myapp:latest
      user: "1000:1000"
      ports:
        - 8080:80
      volumes:
        - ./data:/app/data
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_yaml_syntax",
      severity: "error",
      title: "docker-compose.yml is not a valid YAML file",
      message: expect.any(String),
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return errors for not matching the schema", async () => {
    const content = `
version: "3"
services:
  app:
    image: myapp:latest
    user: "1000:1000"
    wrong: true
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "additionalProperties",
      severity: "error",
      title: "/services/app",
      message: "must NOT have additional properties",
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return errors for invalid image names", async () => {
    const content = `
version: "3"
services:
  app:
    image: myapp:test
    user: "1000:1000"
    volumes:
      - ./data:/app/data
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_docker_image_name",
      severity: "error",
      title: 'Invalid image name "myapp:test"',
      message: 'Images should be named like "<name>:<version-tag>@<sha256>"',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return warnings for images with 'latest' tag", async () => {
    const content = `
version: "3"
services:
  app:
    image: myapp:latest@sha256:123456
    user: "1000:1000"
    volumes:
      - ./data:/app/data
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_docker_image_name",
      severity: "warning",
      title: 'Invalid image tag "latest"',
      message: 'Images should not use the "latest" tag',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return errors for invalid YAML boolean values", async () => {
    const content = `
version: "3"
services:
  app:
    user: "1000:1000"
    environment:
      DEBUG: true
    labels:
      production: false
    extra_hosts:
      host: true
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_yaml_boolean_value",
      severity: "error",
      title: 'Invalid YAML boolean value for key "DEBUG"',
      message: 'Boolean values should be strings like "true" instead of true',
      file: `${id}/docker-compose.yml`,
    });
    expect(results[1]).toMatchObject<LintingResult>({
      id: "invalid_yaml_boolean_value",
      severity: "error",
      title: 'Invalid YAML boolean value for key "production"',
      message: 'Boolean values should be strings like "false" instead of false',
      file: `${id}/docker-compose.yml`,
    });
    expect(results[2]).toMatchObject<LintingResult>({
      id: "invalid_yaml_boolean_value",
      severity: "error",
      title: 'Invalid YAML boolean value for key "host"',
      message: 'Boolean values should be strings like "true" instead of true',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return warnings for volumes mounted directly into APP_DATA_DIR", async () => {
    const content = `
version: "3"
services:
  app:
    user: "1000:1000"
    volumes:
      - \${APP_DATA_DIR}:/app/data
      - \${SOME_OTHER_DIR}/data:/app/other
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_app_data_dir_volume_mount",
      severity: "warning",
      title: 'Volume "${APP_DATA_DIR}:/app/data"',
      message:
        'Volumes should not be mounted directly into the "${APP_DATA_DIR}" directory! Please use a subdirectory like "${APP_DATA_DIR}/data/app/data" instead.',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return infos for missing file/directory in bind mounts", async () => {
    const content = `
version: "3"
services:
  app:
    user: "1000:1000"
    volumes:
      - \${APP_DATA_DIR}/data:/app/data
      - \${SOME_OTHER_DIR}/data:/app/other
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "missing_file_or_directory",
      severity: "info",
      title: 'Mounted file/directory "/umbrel-app/data" doesn\'t exist',
      message:
        'The volume "${APP_DATA_DIR}/data:/app/data" tries to mount the file/directory "/umbrel-app/data", but it is not present. This can lead to permission errors!',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return info messages for external port mappings", async () => {
    const content = `
version: "3"
services:
  app:
    user: "1000:1000"
    ports:
      - 8080:80
      - 443:443
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "external_port_mapping",
      severity: "info",
      title: 'External port mapping "8080:80"',
      message:
        "Port mappings may be unnecessary for the app to function correctly. Docker's internal DNS resolves container names to IP addresses within the same network. External access to the web interface is handled by the app_proxy container. Port mappings are only needed if external access is required to a port not proxied by the app_proxy, or if an app needs to expose multiple ports for its functionality (e.g., DHCP, DNS, P2P, etc.).",
      file: `${id}/docker-compose.yml`,
    });
    expect(results[1]).toMatchObject<LintingResult>({
      id: "external_port_mapping",
      severity: "info",
      title: 'External port mapping "443:443"',
      message:
        "Port mappings may be unnecessary for the app to function correctly. Docker's internal DNS resolves container names to IP addresses within the same network. External access to the web interface is handled by the app_proxy container. Port mappings are only needed if external access is required to a port not proxied by the app_proxy, or if an app needs to expose multiple ports for its functionality (e.g., DHCP, DNS, P2P, etc.).",
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return errors for images with invalid architectures", async () => {
    const content = `
version: "3"
services:
  app:
    image: teamspeak:3.13.7@sha256:10499180e88f24170812e12b34083332a7573ae35a4becba5d7a85d9761050e5
    user: "1000:1000"
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const options = { checkImageArchitectures: true };
    const results = await lintDockerComposeYml(content, id, files, options);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_image_architectures",
      severity: "error",
      title:
        'Invalid image architectures for image "teamspeak:3.13.7@sha256:10499180e88f24170812e12b34083332a7573ae35a4becba5d7a85d9761050e5"',
      message:
        'The image "teamspeak:3.13.7@sha256:10499180e88f24170812e12b34083332a7573ae35a4becba5d7a85d9761050e5" does not support the architectures "arm64" and "amd64". Please make sure that the image supports both architectures.',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return an info message if a root user is being used", async () => {
    const content = `
version: "3.7"

services:
  app:
    user: "root"
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_container_user",
      severity: "info",
      title: `Using unsafe user "root" in service "app"`,
      message: `The user "root" can lead to security vulnerabilities. If possible please use a non-root user instead.`,
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return an info message if no user is specified and UID/PUID environment variable is not set", async () => {
    const content = `
version: "3.7"

services:
  app: {}
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_container_user",
      severity: "info",
      title: `Potentially using unsafe user in service "app"`,
      message: `The default container user "root" can lead to security vulnerabilities. If you are using the root user, please try to specify a different user (e.g. "1000:1000") in the compose file or try to set the UID/PUID and GID/PGID environment variables to 1000.`,
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should not return any info message if a non-root user is specified", async () => {
    const content = `
version: "3.7"

services:
  app:
    user: "1000:1000"
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(0);
  });

  it("should not return any info message if UID/PUID environment variable is set to 1000", async () => {
    const content = `
version: "3.7"

services:
  app:
    environment:
      UID: 1000
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(0);
  });

  it("should return an info message if a service uses host network mode", async () => {
    const content = `
version: "3.7"

services:
  app:
    user: "1000:1000"
    network_mode: host

  server:
    user: "1000:1000"
    network_mode: host
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "container_network_mode_host",
      severity: "info",
      title: 'Service "app" uses host network mode',
      message:
        "The host network mode can lead to security vulnerabilities. If possible please use the default bridge network mode and expose the necessary ports.",
      file: `${id}/docker-compose.yml`,
    });
    expect(results[1]).toMatchObject<LintingResult>({
      id: "container_network_mode_host",
      severity: "info",
      title: 'Service "server" uses host network mode',
      message:
        "The host network mode can lead to security vulnerabilities. If possible please use the default bridge network mode and expose the necessary ports.",
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should not return any info message if no service uses host network mode", async () => {
    const content = `
version: "3.7"

services:
  app:
    user: "1000:1000"

  server:
    user: "1000:1000"
    network_mode: bridge
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(0);
  });

  it("should return an warning for invalid APP_HOST", async () => {
    const content = `
version: "3.7"

services:
  app_proxy:
    environment:
      APP_HOST: invalid
      APP_PORT: 80
`;
    const id = "umbrel-app";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_app_proxy_configuration",
      severity: "warning",
      title: "Invalid APP_HOST environment variable",
      message:
        'The APP_HOST environment variable must be set to the hostname of the app_proxy container (e.g. "<app-id>_<web-container-name>_1").',
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return a warning for invalid APP_PORT", async () => {
    const content = `
version: "3.7"

services:
  app_proxy:
    environment:
      APP_HOST: file-browser_server_1
      APP_PORT: invalid

  server:
    user: "1000:1000"
`;
    const id = "file-browser";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_app_proxy_configuration",
      severity: "warning",
      title: "Invalid APP_PORT environment variable",
      message:
        "The APP_PORT environment variable must be set to the port the ui of the app inside the container is listening on.",
      file: `${id}/docker-compose.yml`,
    });
  });

  it("should return an error for invalid restart policy", async () => {
    const content = `
version: "3.7"

services:
  app_proxy:
    environment:
      APP_HOST: file-browser_server_1
      APP_PORT: 80

  server:
    user: "1000:1000"
    restart: always
`;
    const id = "file-browser";
    const files: Entry[] = [];
    const results = await lintDockerComposeYml(content, id, files);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "invalid_restart_policy",
      severity: "warning",
      title: "Invalid restart policy",
      message:
        'The restart policy of the container "server" should be set to "on-failure".',
      file: `${id}/docker-compose.yml`,
    });
  });
});

describe("lintDirectoryStructure", () => {
  it("should return an error for empty directories", () => {
    const files: Entry[] = [
      { path: "app", type: "directory" },
      { path: "app/.gitkeep", type: "file" },
      { path: "app/data", type: "directory" },
      { path: "app/data/.gitkeep", type: "file" },
      { path: "app/logs", type: "directory" },
      { path: "app/public", type: "directory" },
      { path: "app/public/.gitkeep", type: "file" },
    ];

    const results = lintDirectoryStructure(files);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<LintingResult>({
      id: "empty_app_data_directory",
      severity: "error",
      title: 'Empty directory "app/logs"',
      message:
        'Please add a ".gitkeep" file to the directory "app/logs". This is necessary to ensure the correct permissions of the directory after cloning!',
      file: "app/logs",
    });
  });

  it("should not return an error for directories with .gitkeep files", () => {
    const files: Entry[] = [
      { path: "app", type: "directory" },
      { path: "app/.gitkeep", type: "file" },
      { path: "app/data", type: "directory" },
      { path: "app/data/.gitkeep", type: "file" },
      { path: "app/logs", type: "directory" },
      { path: "app/logs/.gitkeep", type: "file" },
      { path: "app/public", type: "directory" },
      { path: "app/public/.gitkeep", type: "file" },
    ];

    const results = lintDirectoryStructure(files);

    expect(results).toEqual([]);
  });
});
