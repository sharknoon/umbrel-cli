import { Image } from "./image";

interface RegistryInfo {
  host: string;
  auth?: AuthInfo;
}

export interface AuthInfo {
  realm: string;
  service: string;
  scope?: string;
}

const registryCache = new Map<string, RegistryInfo | false>();

export async function getAuthInfo(image: Image): Promise<RegistryInfo> {
  // skip the check if the cache hits
  const hit = registryCache.get(image.APIHost);
  if (hit) {
    return hit;
  }
  // call /v2/ and check if it returns a 200 status code
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    const result = await fetch(`https://${image.APIHost}/v2/`, {
      signal: controller.signal,
    });
    const isRegistry =
      result.headers.get("Docker-Distribution-Api-Version") === "registry/2.0";
    if (!isRegistry) {
      throw new Error(
        `"${image.APIHost}" is not a valid CNCF distribution registry`,
      );
    }

    let auth: AuthInfo | undefined = undefined;
    const needsAuth = result.status === 401;
    if (needsAuth) {
      const authHeader = result.headers.get("Www-Authenticate");
      if (!authHeader) {
        throw new Error(`Missing auth header for "${result.url}"`);
      }
      auth = parseAuthHeader(authHeader);
    }

    const registryInfo: RegistryInfo = { host: image.APIHost, auth };
    registryCache.set(image.APIHost, registryInfo);

    return registryInfo;
  } catch (error) {
    registryCache.set(image.APIHost, false);
    throw error;
  }
}

export function parseAuthHeader(header: string): AuthInfo {
  if (!header.startsWith("Bearer")) {
    throw new Error(`Only Bearer token authorization is supported: ${header}`);
  }
  const realm = header.match(/realm="(.*?)"/)?.[1];
  if (!realm) {
    throw new Error(`Failed to get realm from auth header: ${header}`);
  }
  const service = header.match(/service="(.*?)"/)?.[1];
  if (!service) {
    throw new Error(`Failed to get service from auth header: ${header}`);
  }
  const scope = header.match(/scope="(.*?)"/)?.[1];
  return { realm, service, scope };
}

export async function getToken(image: Image): Promise<string | undefined> {
  const authInfo = await getAuthInfo(image);
  if (!authInfo.auth) {
    return;
  }
  const url = new URL(authInfo.auth.realm);
  url.searchParams.set("service", authInfo.auth.service);
  url.searchParams.set("scope", `repository:${image.APIPath}:pull`);
  const response = await fetch(url);
  const json = await response.json();
  return json.token;
}

export async function fetchRegistry(
  image: Image,
  input: string | URL | globalThis.Request,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken(image);
  const headers = new Headers(init?.headers);
  if (token) {
    headers.append("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function getDigest(image: Image): Promise<string> {
  const result = await fetchRegistry(
    image,
    `https://${image.APIHost}/v2/${image.APIPath}/manifests/${image.tag}`,
    { method: "HEAD" },
  );
  if (!result.ok) {
    throw new Error(
      `HTTP ${result.status} for ${image.toString()}: ${await result.text()}`,
    );
  }
  const digest = result.headers.get("Docker-Content-Digest");
  if (!digest) {
    throw new Error("Missing digest in the response headers");
  }
  return digest;
}

export interface ManifestListV2 {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.list.v2+json";
  manifests: {
    mediaType: string;
    size: number;
    digest: string;
    platform: {
      architecture: string;
      os: string;
      "os.version"?: string;
      "os.features"?: string[];
      variant?: string;
      features?: string[];
    };
  }[];
}

export interface ManifestV2 {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.v2+json";
  artifactType?: string;
  config: {
    mediaType: "application/vnd.docker.container.image.v1+json";
    size: number;
    digest: string;
  };
  layers: {
    mediaType: "application/vnd.docker.image.rootfs.diff.tar.gzip";
    size: number;
    digest: string;
    urls?: string[];
  }[];
}

export interface ManifestIndexV1 {
  schemaVersion: 2;
  mediaType: "application/vnd.oci.image.index.v1+json";
  artifactType?: string;
  manifests: {
    mediaType:
      | "application/vnd.oci.image.manifest.v1+json"
      | "application/vnd.oci.image.index.v1+json";
    digest: string;
    size: number;
    urls?: string[];
    annotations?: Record<string, string>;
    data?: string;
    artifactType?: string;
    platform: {
      architecture: string;
      os: string;
      "os.version"?: string;
      "os.features"?: string[];
      variant?: string;
      features?: string[];
    };
  }[];
  subject?: {
    mediaType: string;
    digest: string;
    size: number;
    urls?: string[];
    annotations?: Record<string, string>;
    data?: string;
    artifactType?: string;
  };
  annotations?: Record<string, string>;
}

export interface ManifestV1 {
  schemaVersion: 2;
  mediaType: "application/vnd.oci.image.manifest.v1+json";
  config: {
    mediaType: "application/vnd.oci.image.config.v1+json";
    digest: string;
    size: number;
    urls?: string[];
    annotations?: Record<string, string>;
  };
  layers: {
    mediaType:
      | "application/vnd.oci.image.layer.v1.tar"
      | "application/vnd.oci.image.layer.v1.tar+gzip"
      | "application/vnd.oci.image.layer.nondistributable.v1.tar"
      | "application/vnd.oci.image.layer.nondistributable.v1.tar+gzip";
    digest: string;
    size: number;
    urls?: string[];
    annotations?: Record<string, string>;
  }[];
  annotations?: Record<string, string>;
}

export async function getManifest(
  image: Image,
): Promise<ManifestV1 | ManifestIndexV1 | ManifestV2 | ManifestListV2> {
  const headers = new Headers();
  headers.append(
    "Accept",
    "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json",
  );
  const result = await fetchRegistry(
    image,
    `https://${image.APIHost}/v2/${image.APIPath}/manifests/${image.digest ? encodeURIComponent(image.digest) : image.tag}`,
    { headers },
  );
  if (!result.ok) {
    throw new Error(
      `HTTP ${result.status} for ${image.toString()}: ${await result.text()}`,
    );
  }
  const json = await result.json();
  const contentType = result.headers.get("Content-Type");
  switch (contentType) {
    case "application/vnd.oci.image.manifest.v1+json":
      return json as ManifestV1;
    case "application/vnd.oci.image.index.v1+json":
      return json as ManifestIndexV1;
    case "application/vnd.docker.distribution.manifest.v2+json":
      return json as ManifestV2;
    case "application/vnd.docker.distribution.manifest.list.v2+json":
      return json as ManifestListV2;
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}

export async function isMultiplatformImage(
  image: Image,
  architectures: { os: string; architecture: string; variant?: string }[] = [
    { os: "linux", architecture: "arm64" },
    { os: "linux", architecture: "amd64" },
  ],
): Promise<boolean> {
  const manifest = await getManifest(image);
  switch (manifest.mediaType) {
    case "application/vnd.oci.image.manifest.v1+json":
      return false;
    case "application/vnd.docker.distribution.manifest.v2+json":
      return false;
    case "application/vnd.oci.image.index.v1+json":
    case "application/vnd.docker.distribution.manifest.list.v2+json":
      return architectures.every((arch) =>
        manifest.manifests.some(
          (m) =>
            (!arch.os || arch.os === m.platform.os) &&
            arch.architecture === m.platform.architecture &&
            (!arch.variant || arch.variant === m.platform.variant),
        ),
      );
  }
}
