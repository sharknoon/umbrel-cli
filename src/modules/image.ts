import { isRegistry } from "./registry";

interface Image {
  host: string;
  path: string;
  tag: string;
  digest?: string;
}

export async function resolveImage(image: string): Promise<Image> {
  const regex =
    /^(?<path>[a-z0-9_.:-]+?(?:\/[a-z0-9_.-]+)*)(?::(?<tag>[a-zA-Z0-9_.-]+))?(?!.*(?<!.*@.*):)(?:@(?<digest>[a-z0-9]+:[0-9a-f]{64}))?$/m;
  const result = regex.exec(image);
  if (!result || !result.groups) {
    throw new Error(`Invalid image format: ${image}`);
  }
  let { path } = result.groups;
  const tag = result.groups.tag || "latest";
  const { digest } = result.groups;

  const pathSegments = path.split("/");
  let host = "registry.hub.docker.com";
  if (pathSegments.length === 1) {
    return { host, path, tag, digest };
  }

  let firstSegment = pathSegments[0];

  // docker.io is not a valid CNCF distribution registry => replace with the actual one
  if (firstSegment === "docker.io") {
    firstSegment = "registry.hub.docker.com";
  }

  if (await isRegistry(firstSegment)) {
    host = firstSegment;
    path = pathSegments.slice(1).join("/");
  }

  return { host, path, tag, digest };
}
