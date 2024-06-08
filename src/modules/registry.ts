const registryCache = new Map<string, boolean>();
// add some well known registries to the cache
registryCache.set("registry.hub.docker.com", true);
registryCache.set("ghcr.io", true);
registryCache.set("quay.io", true);

export async function isRegistry(host: string): Promise<boolean> {
  // skip the check if the cache hits
  if (registryCache.has(host)) {
    return registryCache.get(host)!;
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
    registryCache.set(host, isRegistry);
    return isRegistry;
  } catch (error) {
    registryCache.set(host, false);
    return false;
  }
}

export async function getDigest(host: string, path: string, tag: string): Promise<string> {
  const result = await fetch(`https://${host}/v2/${path}/manifests/${tag}`, {
    method: "HEAD",
    headers: {
      Accept: "application/vnd.oci.image.index.v1+json",
    },
  })
  const digest = result.headers.get("Docker-Content-Digest");
  if (!digest) {
    throw new Error(`Failed to get digest for ${host}/${path}:${tag}`);
  }
  return digest;
}