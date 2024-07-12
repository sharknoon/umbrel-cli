interface RegistryInfo {
  host: string;
  needsAuth: boolean;
  auth?: string;
}

const registryCache = new Map<string, RegistryInfo | false>();

export async function analyzeRegistry(
  host: string,
): Promise<RegistryInfo | false> {
  // skip the check if the cache hits
  const hit = registryCache.get(host);
  if (hit) {
    return hit;
  }
  // call /v2/ and check if it returns a 200 status code
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    const result = await fetch(`https://${host}/v2/`, {
      signal: controller.signal,
    });
    const isRegistry =
      result.headers.get("docker-distribution-api-version") === "registry/2.0";
    if (!isRegistry) {
      registryCache.set(host, false);
      return false;
    }

    const needsAuth = result.status === 401;
    if (needsAuth) {
      const authHeader = result.headers.get("www-authenticate");
      if (!authHeader) {
        console.error(`❌ Missing auth header for ${host}`);
        registryCache.set(host, false);
        return false;
      }
      const authInfo = _parseAuthHeader(authHeader);
      if (!authInfo) {
        registryCache.set(host, false);
        return false;
      }
    }

    return isRegistry;
  } catch (error) {
    registryCache.set(host, false);
    return false;
  }
}

export async function getDigest(
  host: string,
  path: string,
  tag: string,
): Promise<string> {
  const result = await fetch(`https://${host}/v2/${path}/manifests/${tag}`, {
    method: "HEAD",
    headers: {
      Accept: "application/vnd.oci.image.index.v1+json",
    },
  });
  const digest = result.headers.get("Docker-Content-Digest");
  if (!digest) {
    throw new Error(`Failed to get digest for ${host}/${path}:${tag}`);
  }
  return digest;
}

function _parseAuthHeader(header: string):
  | {
      realm: string;
      service: string;
    }
  | false {
  if (!header.startsWith("Bearer")) {
    console.error(`❌ Only Bearer token authorization is supported: ${header}`);
    return false;
  }
  const realm = header.match(/realm="(.*?)"/)?.[1];
  if (!realm) {
    console.error(`❌ Failed to get realm from auth header: ${header}`);
    return false;
  }
  const service = header.match(/service="(.*?)"/)?.[1];
  if (!service) {
    console.error(`❌ Failed to get service from auth header: ${header}`);
    return false;
  }
  return { realm, service };
}
