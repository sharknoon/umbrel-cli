export async function isRegistry(host: string): Promise<boolean> {
  // skip the check for some well known registries
  if (["registry.hub.docker.com", "ghcr.io", "quay.io"].includes(host)) {
    return true;
  }
  // call /v2/ and check if it returns a 200 status code
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const result = await fetch(`https://${host}/v2/`, {
      signal: controller.signal,
    });
    return (
      result.headers.get("docker-distribution-api-version") === "registry/2.0"
    );
  } catch (error) {
    return false;
  }
}

function needsAuth(host: string) {}
