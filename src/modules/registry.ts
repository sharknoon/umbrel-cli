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
      `HTTP ${result.status} for ${image.host}/${image.path}:${image.tag}`,
    );
  }
  const digest = result.headers.get("Docker-Content-Digest");
  if (!digest) {
    throw new Error("Missing digest in the response headers");
  }
  return digest;
}
