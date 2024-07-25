export class Image {
  #host?: string;
  #path: string;
  #tag?: string;
  #digest?: string;

  constructor({
    host,
    path,
    tag,
    digest,
  }: {
    host?: string;
    path: string;
    tag?: string;
    digest?: string;
  }) {
    this.#host = host;
    this.#path = path;
    this.#tag = tag;
    this.#digest = digest;
  }

  static #fixAPIHost(host: string): string {
    if (host === "docker.io") {
      return "registry.hub.docker.com";
    }
    return host;
  }

  static async fromString(image: string): Promise<Image> {
    const regex =
      /^(?<path>[a-z0-9_.:-]+?(?:\/[a-z0-9_.-]+)*)(?::(?<tag>[a-zA-Z0-9_.-]+))?(?!.*(?<!.*@.*):)(?:@(?<digest>[a-z0-9]+:[0-9a-f]{64}))?$/m;
    const result = regex.exec(image);
    if (!result || !result.groups) {
      throw new Error(`Invalid image format: ${image}`);
    }
    let path = result.groups.path;
    const { tag, digest } = result.groups;

    const pathSegments = path.split("/");
    if (pathSegments.length === 1) {
      return new Image({ host: undefined, path, tag, digest });
    }

    // Check if the first segment is a registry host
    // The image can be either "org/image:tag" or "host/image:tag"
    // E.g. "library/nginx:latest" or "docker.io/nginx:latest" or "localhost/nginx:latest"
    // Looging for a "." in the first segment can't be used to determine if the first segment is a host,
    // because any hostname is valid, for example "localhost"
    let host = undefined;
    if (await Image.isRegistry(pathSegments[0])) {
      host = pathSegments[0];
      path = pathSegments.slice(1).join("/");
    }

    return new Image({ host, path, tag, digest });
  }

  static #registryCache = new Map<string, boolean>();

  static async isRegistry(host: string): Promise<boolean> {
    host = Image.#fixAPIHost(host);

    // skip the check if the cache hits
    const hit = Image.#registryCache.get(host);
    if (typeof hit === "boolean") {
      return hit;
    }
    // call /v2/ and check if it returns a 200 status code
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1000);
      const result = await fetch(`https://${host}/v2/`, {
        signal: controller.signal,
      });
      return (
        result.headers.get("Docker-Distribution-Api-Version") === "registry/2.0"
      );
    } catch {
      Image.#registryCache.set(host, false);
      return false;
    }
  }

  get host(): string {
    return this.#host || "docker.io";
  }

  get APIHost(): string {
    return Image.#fixAPIHost(this.host);
  }

  get path(): string {
    return this.#path;
  }

  get APIPath(): string {
    const path = this.path;
    if (!path.includes("/")) {
      return `library/${this.#path}`;
    }
    return path;
  }

  get tag(): string {
    return this.#tag || "latest";
  }

  get digest(): string | undefined {
    return this.#digest;
  }

  toString(): string {
    let result = this.#path;
    if (this.#host) {
      result = `${this.#host}/${result}`;
    }
    if (this.#tag) {
      result = `${result}:${this.#tag}`;
    }
    if (this.#digest) {
      result = `${result}@${this.#digest}`;
    }
    return result;
  }

  async toFullString(): Promise<string> {
    return `${this.host}/${this.path}:${this.tag}${this.digest ? `@${this.digest}` : ""}`;
  }
}
