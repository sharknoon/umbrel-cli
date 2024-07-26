import path from "node:path";
import YAML from "yaml";
import umbrelAppStoreYmlSchema from "../schemas/umbrel-app-store.yml.schema";
import { mockVariables } from "./mock";
import { ComposeSpecification } from "../schemas/docker-compose.yml.schema";
import Ajv from "ajv";
import { DefinedError } from "ajv";
import addFormats from "ajv-formats";
import dockerComposeYmlSchema from "../schemas/docker-compose.yml.schema.json";
import umbrelAppYmlSchema from "../schemas/umbrel-app.yml.schema";
import { ZodIssueCode } from "zod";
import { getSourceMapForKey } from "../utils/yaml";
import { getArchitectures } from "./registry";
import { Image } from "./image";
import { z } from "zod";

export interface LintingResult {
  id:
    | ZodIssueCode
    | DefinedError["keyword"]
    | "invalid_yaml_syntax"
    | "invalid_docker_image_name"
    | "invalid_yaml_boolean_value"
    | "invalid_app_data_dir_volume_mount"
    | "invalid_submission_field"
    | "missing_file_or_directory"
    | "empty_app_data_directory"
    | "external_port_mapping"
    | "invalid_image_architectures"
    | "invalid_container_user"
    | "filled_out_release_notes_on_first_submission"
    | "container_network_mode_host";
  propertiesPath?: string;
  line?: { start: number; end: number }; // Starting at 1
  column?: { start: number; end: number }; // Starting at 1
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  file: string;
}

const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.received === "undefined") {
      return { message: `The "${issue.path.join(".")}" key is required` };
    }
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);

export async function lintUmbrelAppStoreYml(
  content: string,
): Promise<LintingResult[]> {
  // check if the file is valid yaml
  let umbrelAppStoreYml;
  try {
    umbrelAppStoreYml = YAML.parse(content);
  } catch (e) {
    return [
      {
        id: "invalid_yaml_syntax",
        severity: "error",
        title: "umbrel-app-store.yml is not a valid YAML file",
        message: String(e),
        file: "umbrel-app-store.yml",
      },
    ];
  }

  // zod parse the file
  const schema = await umbrelAppStoreYmlSchema();
  const result = await schema.safeParseAsync(umbrelAppStoreYml);
  if (!result.success) {
    return result.error.issues.map(
      (issue) =>
        ({
          id: issue.code,
          propertiesPath: issue.path.join("."),
          ...getSourceMapForKey(content, issue.path),
          severity: "error",
          title: issue.path.join("."),
          message: issue.message,
          file: "umbrel-app-store.yml",
        }) satisfies LintingResult,
    );
  }
  return [];
}

export interface LintUmbrelAppYmlOptions {
  isNewAppSubmission?: boolean;
  pullRequestUrl?: string;
}

export async function lintUmbrelAppYml(
  content: string,
  id: string,
  options: LintUmbrelAppYmlOptions = {},
): Promise<LintingResult[]> {
  // check if the file is valid yaml
  let rawUmbrelAppYml;
  try {
    rawUmbrelAppYml = YAML.parse(content);
  } catch (e) {
    return [
      {
        id: "invalid_yaml_syntax",
        severity: "error",
        title: "umbrel-app.yml is not a valid YAML file",
        message: String(e),
        file: `${id}/umbrel-app.yml`,
      },
    ];
  }

  // zod parse the file
  const schema = await umbrelAppYmlSchema();
  const parsedUmbrelAppYml = await schema.safeParseAsync(rawUmbrelAppYml);
  let result: LintingResult[] = [];
  if (!parsedUmbrelAppYml.success) {
    result = parsedUmbrelAppYml.error.issues.map(
      (issue) =>
        ({
          id: issue.code,
          propertiesPath: issue.path.join("."),
          ...getSourceMapForKey(content, issue.path),
          severity: "error",
          title: issue.path.join("."),
          message: issue.message,
          file: `${id}/umbrel-app.yml`,
        }) satisfies LintingResult,
    );
  }

  // If this is being called by another program in library mode (like a GitHub Action)
  // and this is a new app submission, check if the submission field corresponds to the pull request URL
  if (
    options.isNewAppSubmission &&
    options.pullRequestUrl &&
    rawUmbrelAppYml.submission !== options.pullRequestUrl
  ) {
    result.push({
      id: "invalid_submission_field",
      severity: "error",
      propertiesPath: "submission",
      ...getSourceMapForKey(content, ["submission"]),
      title: `Invalid submission field "${rawUmbrelAppYml.submission}"`,
      message: `The submission field must be set to the URL of this pull request: ${options.pullRequestUrl}`,
      file: `${id}/umbrel-app.yml`,
    });
  }

  // If this is a new app submisson, make sure that the release notes field is empty
  if (
    options.isNewAppSubmission &&
    typeof rawUmbrelAppYml.releaseNotes === "string" &&
    rawUmbrelAppYml.releaseNotes.length > 0
  ) {
    result.push({
      id: "filled_out_release_notes_on_first_submission",
      severity: "error",
      propertiesPath: "releaseNotes",
      ...getSourceMapForKey(content, ["releaseNotes"]),
      title: `"releaseNotes" needs to be empty for new app submissions`,
      message: `The "releaseNotes" field must be empty for new app submissions as it is being displayed to the user only in case of an update.`,
      file: `${id}/umbrel-app.yml`,
    });
  }

  return result;
}

export interface Entry {
  path: string;
  type: "file" | "directory";
}

export async function lintDockerComposeYml(
  content: string,
  id: string,
  files: Entry[],
  options: { checkImageArchitectures?: boolean } = {},
): Promise<LintingResult[]> {
  // Mock the variables
  const rawDockerComposeYmlMocked = await mockVariables(content);

  // check if the file is valid yaml
  let dockerComposeYml;
  let dockerComposeYmlMocked: ComposeSpecification;
  try {
    dockerComposeYml = YAML.parse(content, {
      merge: true,
    });
    dockerComposeYmlMocked = YAML.parse(rawDockerComposeYmlMocked, {
      merge: true,
    });
  } catch (e) {
    return [
      {
        id: "invalid_yaml_syntax",
        severity: "error",
        title: "docker-compose.yml is not a valid YAML file",
        message: String(e),
        file: `${id}/docker-compose.yml`,
      },
    ];
  }

  // Check if the file is a valid docker compose file
  const ajv = new Ajv({ allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile<ComposeSpecification>(dockerComposeYmlSchema);
  const validAppYaml = validate(dockerComposeYmlMocked);
  if (!validAppYaml) {
    return ((validate.errors as DefinedError[]) ?? []).map(
      (error) =>
        ({
          id: error.keyword,
          propertiesPath: path
            .normalize(error.instancePath)
            .split(path.sep)
            .filter(Boolean)
            .join("."),
          ...getSourceMapForKey(
            content,
            path.normalize(error.instancePath).split(path.sep).filter(Boolean),
          ),
          severity: "error",
          title: error.instancePath,
          message: error.message ?? "Unknown error",
          file: `${id}/docker-compose.yml`,
        }) satisfies LintingResult,
    );
  }

  const result: LintingResult[] = [];
  const services = Object.keys(dockerComposeYml.services ?? {});
  const servicesMocked = Object.keys(dockerComposeYmlMocked.services ?? {});

  // Check if the image follows the naming convention
  for (const service of servicesMocked) {
    const image = dockerComposeYmlMocked.services?.[service].image;
    if (!image) {
      continue;
    }
    const imageMatch = image.match(/^(.+):(.+)@(.+)$/);
    if (!imageMatch) {
      result.push({
        id: "invalid_docker_image_name",
        propertiesPath: `services.${service}.image`,
        ...getSourceMapForKey(content, ["services", service, "image"]),
        severity: "error",
        title: `Invalid image name "${image}"`,
        message: `Images should be named like "<name>:<version-tag>@<sha256>"`,
        file: `${id}/docker-compose.yml`,
      });
    } else {
      const [, version] = imageMatch.slice(1);
      if (version === "latest") {
        result.push({
          id: "invalid_docker_image_name",
          propertiesPath: `services.${service}.image`,
          ...getSourceMapForKey(content, ["services", service, "image"]),
          severity: "warning",
          title: `Invalid image tag "${version}"`,
          message: `Images should not use the "latest" tag`,
          file: `${id}/docker-compose.yml`,
        });
      }
    }
  }

  // Check if the keys "environment", "labels", and "extra_hosts" contains bare booleans (true instead of "true")
  // Note this is only an issue in Docker Compose V1. As soon as umbrelOS 0.5 is no longer supported, this check
  // is unnecessary as umbrelOS >= 1 uses Docker Compose V2 which allows bare boolean values
  for (const service of servicesMocked) {
    const environment = dockerComposeYmlMocked.services?.[service].environment;
    const labels = dockerComposeYmlMocked.services?.[service].labels;
    const extra_hosts = dockerComposeYmlMocked.services?.[service].extra_hosts;
    const properties = [];
    // Nothing to do if it is an string array
    if (environment && !Array.isArray(environment)) {
      properties.push({
        label: "environment",
        entries: Object.entries(environment),
      });
    }
    if (labels && !Array.isArray(labels)) {
      properties.push({ label: "labels", entries: Object.entries(labels) });
    }
    if (extra_hosts && !Array.isArray(extra_hosts)) {
      properties.push({
        label: "extra_hosts",
        entries: Object.entries(extra_hosts),
      });
    }

    for (const property of properties) {
      for (const [key, value] of property.entries) {
        if (typeof value === "boolean") {
          result.push({
            id: "invalid_yaml_boolean_value",
            propertiesPath: `services.${service}.${property.label}.${key}`,
            ...getSourceMapForKey(content, [
              "services",
              service,
              property.label,
              key,
            ]),
            severity: "error",
            title: `Invalid YAML boolean value for key "${key}"`,
            message: `Boolean values should be strings like "${value}" instead of ${value}`,
            file: `${id}/docker-compose.yml`,
          });
        }
      }
    }
  }

  // Check if this app puts data directly into the ${APP_DATA_DIR} directory
  // If so, print a warning, because this is not future proof. If the submitter wants to add something
  // later, there is no clear distinction like when using directories.
  for (const service of services) {
    const volumes = dockerComposeYml.services?.[service]?.volumes;
    // if the volumes is an array
    if (volumes && Array.isArray(volumes)) {
      for (const volume of volumes) {
        if (typeof volume === "string") {
          if (volume.match(/\$\{?APP_DATA_DIR\}?\/?:/)) {
            result.push({
              id: "invalid_app_data_dir_volume_mount",
              propertiesPath: `services.${service}.volumes`,
              ...getSourceMapForKey(content, ["services", service, "volumes"]),
              severity: "warning",
              title: `Volume "${volume}"`,
              message: `Volumes should not be mounted directly into the "\${APP_DATA_DIR}" directory! Please use a subdirectory like "\${APP_DATA_DIR}/data${volume.split(":")[1] ?? ""}" instead.`,
              file: `${id}/docker-compose.yml`,
            });
          }
        } else if (
          typeof volume === "object" &&
          "source" in volume &&
          "target" in volume
        ) {
          if (volume.source.match(/\$\{?APP_DATA_DIR\}?\/?$/)) {
            result.push({
              id: "invalid_app_data_dir_volume_mount",
              propertiesPath: `services.${service}.volumes`,
              ...getSourceMapForKey(content, ["services", service, "volumes"]),
              severity: "warning",
              title: `Volume "${volume.source}:${volume.target}"`,
              message: `Volumes should not be mounted directly into the "\${APP_DATA_DIR}" directory! Please use a subdirectory like "source: \${APP_DATA_DIR}/data" and "target: ${volume.target ?? "/some/dir"}" instead.`,
              file: `${id}/docker-compose.yml`,
            });
          }
        }
      }
    }
  }

  // Check if all bind mounts, that are like this "${APP_DATA_DIR}/some/dir:/some/dir" are present
  for (const service of services) {
    const volumes = dockerComposeYml.services?.[service]?.volumes;
    // if the volumes is an array
    if (volumes && Array.isArray(volumes)) {
      for (const volume of volumes) {
        if (typeof volume === "string") {
          if (volume.match(/\$\{?APP_DATA_DIR\}?/)) {
            const match = volume.match(/\$\{?APP_DATA_DIR\}?\/?(.*?):/)?.[1];
            if (!match) {
              continue;
            }
            if (!files.map((f) => f.path).includes(`${id}/${match}`)) {
              result.push({
                id: "missing_file_or_directory",
                propertiesPath: `services.${service}.volumes`,
                ...getSourceMapForKey(content, [
                  "services",
                  service,
                  "volumes",
                ]),
                severity: "info",
                title: `Mounted file/directory "/${id}/${match}" doesn't exist`,
                message: `The volume "${volume}" tries to mount the file/directory "/${id}/${match}", but it is not present. This can lead to permission errors!`,
                file: `${id}/docker-compose.yml`,
              });
            }
          }
        } else if (
          typeof volume === "object" &&
          "source" in volume &&
          "target" in volume
        ) {
          if (volume.source.match(/\$\{?APP_DATA_DIR\}?/)) {
            const match = volume.source.match(
              /\$\{?APP_DATA_DIR\}?\/?(.*?)$/,
            )?.[1];
            if (!match) {
              continue;
            }
            if (!files.map((f) => f.path).includes(`${id}/${match}`)) {
              result.push({
                id: "missing_file_or_directory",
                propertiesPath: `services.${service}.volumes`,
                ...getSourceMapForKey(content, [
                  "services",
                  service,
                  "volumes",
                ]),
                severity: "info",
                title: `Mounted file/directory "/${id}/${match}" doesn't exist`,
                message: `The volume "${volume.source}:${volume.target}" tries to mount the file/directory "/${id}/${match}", but it is not present. This can lead to permission errors!`,
                file: `${id}/docker-compose.yml`,
              });
            }
          }
        }
      }
    }
  }

  // Print an info message for all port mappings, informing the user, that this may be unnecessary
  for (const service of services) {
    const ports = dockerComposeYml.services?.[service].ports;
    if (ports && Array.isArray(ports)) {
      for (const port of ports) {
        if (typeof port === "string" || typeof port === "number") {
          result.push({
            id: "external_port_mapping",
            propertiesPath: `services.${service}.ports`,
            ...getSourceMapForKey(content, ["services", service, "ports"]),
            severity: "info",
            title: `External port mapping "${port}"`,
            message:
              "Port mappings may be unnecessary for the app to function correctly. Docker's internal DNS resolves container names to IP addresses within the same network. External access to the web interface is handled by the app_proxy container. Port mappings are only needed if external access is required to a port not proxied by the app_proxy, or if an app needs to expose multiple ports for its functionality (e.g., DHCP, DNS, P2P, etc.).",
            file: `${id}/docker-compose.yml`,
          });
        } else if (typeof port === "object" && "target" in port) {
          result.push({
            id: "external_port_mapping",
            propertiesPath: `services.${service}.ports`,
            ...getSourceMapForKey(content, ["services", service, "ports"]),
            severity: "info",
            title: `External port mapping "${port.target}${port.published ? `:${port.published}` : ""}`,
            message:
              "Port mappings may be unnecessary for the app to function correctly. Docker's internal DNS resolves container names to IP addresses within the same network. External access to the web interface is handled by the app_proxy container. Port mappings are only needed if external access is required to a port not proxied by the app_proxy, or if an app needs to expose multiple ports for its functionality (e.g., DHCP, DNS, P2P, etc.).",
            file: `${id}/docker-compose.yml`,
          });
        }
      }
    }
  }

  // Check if the image architectures are at least arm64 and amd64
  // The flag "checkImageArchitectures" exists to prevent running into rate limiting by container registries
  // when linting all apps at once
  if (options.checkImageArchitectures) {
    for (const service of services) {
      const imageString = dockerComposeYml.services?.[service].image;
      if (!imageString) {
        continue;
      }

      let image: Image;
      try {
        image = await Image.fromString(imageString);
      } catch (error) {
        // This should never happen, as we already parsed the file before
        // But better be safe
        result.push({
          id: "invalid_docker_image_name",
          severity: "error",
          title: "Invalid image name",
          message: String(error),
          file: `${id}/docker-compose.yml`,
        });
        continue;
      }
      try {
        const architectures = await getArchitectures(image);
        const supportsArm64AndAmd64 =
          architectures.find(
            (a) => a.os === "linux" && a.architecture === "arm64",
          ) &&
          architectures.find(
            (a) => a.os === "linux" && a.architecture === "amd64",
          );
        if (!supportsArm64AndAmd64) {
          result.push({
            id: "invalid_image_architectures",
            propertiesPath: `services.${service}.image`,
            ...getSourceMapForKey(content, ["services", service, "image"]),
            severity: "error",
            title: `Invalid image architectures for image "${image}"`,
            message: `The image "${image}" does not support the architectures "arm64" and "amd64". Please make sure that the image supports both architectures.`,
            file: `${id}/docker-compose.yml`,
          });
        }
      } catch (error) {
        result.push({
          id: "invalid_docker_image_name",
          propertiesPath: `services.${service}.image`,
          ...getSourceMapForKey(content, ["services", service, "image"]),
          severity: "error",
          title: `Invalid image name "${image}"`,
          message: String(error),
          file: `${id}/docker-compose.yml`,
        });
      }
    }
  }

  // Check if the container user is being restricted
  // We want to have as little user privileges as possible and the default user (root)
  // should not be used. In case of a breach the attacker would have root access to the host system.
  for (const service of servicesMocked) {
    if (service === "app_proxy") {
      continue;
    }
    const user = dockerComposeYmlMocked.services?.[service].user;
    const environment = dockerComposeYmlMocked.services?.[service].environment;
    let hasUIDEnv = false;
    if (environment) {
      if (Array.isArray(environment)) {
        if (
          environment.includes("UID=1000") ||
          environment.includes("PUID=1000")
        ) {
          hasUIDEnv = true;
        }
      } else {
        for (const [key, value] of Object.entries(environment)) {
          if (key === "UID" || key === "PUID") {
            if (String(value) === "1000") {
              hasUIDEnv = true;
            }
          }
        }
      }
    }
    if (user === "root") {
      result.push({
        id: "invalid_container_user",
        propertiesPath: `services.${service}.user`,
        ...getSourceMapForKey(content, ["services", service, "user"]),
        severity: "info",
        title: `Using unsafe user "${user}" in service "${service}"`,
        message: `The user "${user}" can lead to security vulnerabilities. If possible please use a non-root user instead.`,
        file: `${id}/docker-compose.yml`,
      });
    } else if (!user && !hasUIDEnv) {
      result.push({
        id: "invalid_container_user",
        severity: "info",
        title: `Potentially using unsafe user in service "${service}"`,
        message: `The default container user "root" can lead to security vulnerabilities. If you are using the root user, please try to specify a different user (e.g. "1000:1000") in the compose file or try to set the UID/PUID and GID/PGID environment variables to 1000.`,
        file: `${id}/docker-compose.yml`,
      });
    }
  }

  // Check if some services use the host network mode
  for (const service of servicesMocked) {
    const networkMode = dockerComposeYmlMocked.services?.[service].network_mode;
    if (networkMode === "host") {
      result.push({
        id: "container_network_mode_host",
        propertiesPath: `services.${service}.network_mode`,
        ...getSourceMapForKey(content, ["services", service, "network_mode"]),
        severity: "info",
        title: `Service "${service}" uses host network mode`,
        message: `The host network mode can lead to security vulnerabilities. If possible please use the default bridge network mode and expose the necessary ports.`,
        file: `${id}/docker-compose.yml`,
      });
    }
  }

  return result;
}

export function lintDirectoryStructure(files: Entry[]): LintingResult[] {
  // Check if there is an empty directory (no .gitkeep file)
  const emptyDirectories = files
    .filter((f) => f.type === "directory")
    .filter(
      (f) =>
        !files.some(
          (f2) => f2.path.length > f.path.length && f2.path.startsWith(f.path),
        ),
    );
  const result: LintingResult[] = [];
  for (const directory of emptyDirectories) {
    result.push({
      id: "empty_app_data_directory",
      severity: "error",
      title: `Empty directory "${directory.path}"`,
      message: `Please add a ".gitkeep" file to the directory "${directory.path}". This is necessary to ensure the correct permissions of the directory after cloning!`,
      file: directory.path,
    });
  }
  return result;
}
