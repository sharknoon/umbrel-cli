import path from "node:path";
import YAML from "yaml";
import umbrelAppStoreYmlSchema from "../schemas/umbrel-app-store.yml.schema";
import { mockVariables } from "./mock";
import { ComposeSpecification } from "../schemas/docker-compose.yml.schema";
import Ajv from "ajv";
import { DefinedError } from "ajv"
import addFormats from "ajv-formats";
import dockerComposeYmlSchema from "../schemas/docker-compose.yml.schema.json";
import umbrelAppYmlSchema from "../schemas/umbrel-app.yml.schema";
import { ZodIssueCode } from "zod";
import { getSourceMapForKey } from "../utils/yaml";

export interface LintingResult {
    id: ZodIssueCode | DefinedError["keyword"] | "invalid_yaml_syntax" | "invalid_docker_image_name" | "invalid_yaml_boolean_value",
    propertiesPath?: string;
    line?: { start: number, end: number }, // Starting at 1
    column?: { start: number, end: number }, // Starting at 1
    severity: "error" | "warning" | "info",
    title: string,
    message: string
}

export async function lintUmbrelAppStoreYml(content: string): Promise<LintingResult[]> {
    // check if the file is valid yaml
    let umbrelAppStoreYml;
    try {
        umbrelAppStoreYml = YAML.parse(content);
    } catch (e) {
        return [{
            id: "invalid_yaml_syntax",
            severity: "error",
            title: "umbrel-app-store.yml is not a valid YAML file",
            message: String(e)
        }]
    }

    // zod parse the file
    const schema = await umbrelAppStoreYmlSchema();
    const result = await schema.safeParseAsync(umbrelAppStoreYml);
    if (!result.success) {
        return result.error.issues.map((issue) => ({
            id: issue.code,
            propertiesPath: issue.path.join("."),
            ...getSourceMapForKey(content, issue.path),
            severity: "error",
            title: issue.path.join("."),
            message: issue.message
        }) satisfies LintingResult);
    }
    return [];
}

export async function lintUmbrelAppYml(content: string): Promise<LintingResult[]> {
    // check if the file is valid yaml
    let umbrelAppYml;
    try {
        umbrelAppYml = YAML.parse(content);
    } catch (e) {
        return [{
            id: "invalid_yaml_syntax",
            severity: "error",
            title: "umbrel-app.yml is not a valid YAML file",
            message: String(e)
        }]
    }

    // zod parse the file
    const schema = await umbrelAppYmlSchema();
    const result = await schema.safeParseAsync(umbrelAppYml);
    if (!result.success) {
        return result.error.issues.map((issue) => ({
            id: issue.code,
            propertiesPath: issue.path.join("."),
            ...getSourceMapForKey(content, issue.path),
            severity: "error",
            title: issue.path.join("."),
            message: issue.message
        }) satisfies LintingResult);
    }

    return [];
}

export async function lintDockerComposeYml(content: string): Promise<LintingResult[]> {
    // Mock the variables
    const rawDockerComposeYmlMocked = await mockVariables(content);

    // check if the file is valid yaml
    let dockerComposeYmlMocked: ComposeSpecification;
    try {
        dockerComposeYmlMocked = YAML.parse(rawDockerComposeYmlMocked, {
            merge: true,
        });
    } catch (e) {
        return [{
            id: "invalid_yaml_syntax",
            severity: "error",
            title: "docker-compose.yml is not a valid YAML file",
            message: String(e)
        }]
    }


    // Check if the file is a valid docker compose file
    const ajv = new Ajv({ allowUnionTypes: true });
    addFormats(ajv);
    const validate = ajv.compile<ComposeSpecification>(dockerComposeYmlSchema);
    const validAppYaml = validate(dockerComposeYmlMocked);
    if (!validAppYaml) {
        return (validate.errors as DefinedError[] ?? []).map(error => ({
            id: error.keyword,
            propertiesPath: path.normalize(error.instancePath).split(path.sep).filter(Boolean).join("."),
            ...getSourceMapForKey(content, path.normalize(error.instancePath).split(path.sep).filter(Boolean)),
            severity: "error",
            title: error.instancePath,
            message: error.message ?? "Unknown error"
        }) satisfies LintingResult)
    }

    // Check if empty folders with .gitkeep exist for every volume
    // This doesn't work properly (no easy way to detect, if a volume mount is a file or a directory)
    /*
    const dockerComposeYml: ComposeSpecification = YAML.parse(
      rawDockerComposeYml,
      { merge: true }
    );
    const hostVolumeMounts = Object.keys(dockerComposeYml.services ?? {}).flatMap(
      (service) => dockerComposeYml.services?.[service].volumes ?? []
    );
    const appDataPaths = new Set<string>();
    for (const volume of hostVolumeMounts) {
      if (typeof volume !== "string") {
        continue;
      }
      const volumeMatch = volume.match(/^\$\{?APP_DATA_DIR\}?(.+?):.*$/);
      if (!volumeMatch || !volumeMatch[1]) {
        continue;
      }
      let appDataPath = path.normalize(volumeMatch[1]);
      //process.stdout.write(appDataPath);
      // In case the path is a file, remove the last path segment
      if (appDataPath.split(path.sep).pop()?.includes(".") ?? false) {
        appDataPath = path.dirname(appDataPath);
      }
      // If there is no directory left, skip
      if (appDataPath === path.sep || appDataPath === ".") {
        continue;
      }
      //console.log(" => " + appDataPath)
      appDataPath = path.join(id, appDataPath);
      appDataPaths.add(appDataPath);
    }
    for (const appDataPath of appDataPaths) {
      if (!(await exists(path.join(cwd, appDataPath, ".gitkeep")))) {
        printLintingError(
          `Missing directory ${pc.cyan(appDataPath)} with ${pc.cyan(".gitkeep")}`,
          `To ensure that the directory have the right permissions, create the directory and add a .gitkeep file in it to keep it in the git repository`
        );
      }
    }
    */

    const result: LintingResult[] = [];
    const services = Object.keys(dockerComposeYmlMocked.services ?? {});

    // Check if the image follows the naming convention
    for (const service of services) {
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
                message: `Images should be named like "<name>:<version-tag>@<sha256>"`
            })
        } else {
            const [, version] = imageMatch.slice(1);
            if (version === "latest") {
                result.push({
                    id: "invalid_docker_image_name",
                    propertiesPath: `services.${service}.image`,
                    ...getSourceMapForKey(content, ["services", service, "image"]),
                    severity: "warning",
                    title: `Invalid image tag "${version}"`,
                    message: `Images should not use the "latest" tag`
                })
            }
        }
    }

    // Check if the keys "environment", "labels", and "extra_hosts" contains bare booleans (true instead of "true")
    // Note this is only an issue in Docker Compose V1. As soon as umbrelOS 0.5 is no longer supported, this check
    // is unnecessary as umbrelOS >= 1 uses Docker Compose V2 which allows bare boolean values
    for (const service of services) {
        const environment = dockerComposeYmlMocked.services?.[service].environment;
        const labels = dockerComposeYmlMocked.services?.[service].labels;
        const extra_hosts = dockerComposeYmlMocked.services?.[service].extra_hosts;
        const properties = [];
        // Nothing to do if it is an string array
        if (environment && typeof environment === "object") {
            properties.push({ label: "environment", entries: Object.entries(environment) });
        }
        if (labels && typeof labels === "object") {
            properties.push({ label: "labels", entries: Object.entries(labels) });
        }
        if (extra_hosts && typeof extra_hosts === "object") {
            properties.push({ label: "extra_hosts", entries: Object.entries(extra_hosts) });
        }
        for (const property of properties) {
            for (const [key, value] of property.entries) {
                if (typeof value === "boolean") {
                    result.push({
                        id: "invalid_yaml_boolean_value",
                        propertiesPath: `services.${property.label}.${key}`,
                        ...getSourceMapForKey(content, ["services", property.label, key]),
                        severity: "error",
                        title: `Invalid YAML boolean value for key "${key}"`,
                        message: `Boolean values thould be strings like "${value}" instead of ${value}`
                    })
                }
            }
        }
    }

    return result;
}
