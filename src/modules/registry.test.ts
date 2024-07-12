import { describe, it, expect } from "vitest";
import { analyzeRegistry, getDigest, getToken, parseAuthHeader } from "./registry";

describe("analyzeRegistry", () => {
  it("should return the RegistryInfo for a valid registry host", async () => {
    const result = await analyzeRegistry("registry.hub.docker.com");
    expect(result).toBeTruthy();
  });

  it("should return the RegistryInfo for another valid registry host", async () => {
    const result = await analyzeRegistry("ghcr.io");
    expect(result).toBeTruthy();
  });

  it("should return the RegistryInfo for yet another valid registry host", async () => {
    const result = await analyzeRegistry("quay.io");
    expect(result).toBeTruthy();
  });

  it("should return the RegistryInfo for the redirect of docker.io to registry.hub.docker.com", async () => {
    const result = await analyzeRegistry("docker.io");
    expect(result).toBeTruthy();
  });

  it("should throw for an invalid registry host", async () => {
    expect(analyzeRegistry("invalid.registry.com")).rejects.toThrowError();
  });
});

describe("parseAuthHeader", () => {
  it("should throw for an invalid auth header", () => {
    const header = "InvalidAuthHeader";
    expect(() => parseAuthHeader(header)).toThrowError();
  });

  it("should throw if realm is missing in the auth header", () => {
    const header = 'Bearer service="registry.docker.io"';
    expect(() => parseAuthHeader(header)).toThrowError();
  });

  it("should throw if service is missing in the auth header", () => {
    const header = 'Bearer realm="https://auth.docker.io/token"';
    expect(() => parseAuthHeader(header)).toThrowError();
  });

  it("should return the parsed auth info for a valid auth header", () => {
    const header =
      'Bearer realm="https://auth.docker.io/token", service="registry.docker.io"';
    const result = parseAuthHeader(header);
    expect(result).toEqual({
      realm: "https://auth.docker.io/token",
      service: "registry.docker.io",
    });
  });

  it("should return the parsed auth info for another valid auth header", () => {
    const header =
      'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:user/image:pull"';
    const result = parseAuthHeader(header);
    expect(result).toEqual({
      realm: "https://ghcr.io/token",
      service: "ghcr.io",
      scope: "repository:user/image:pull",
    });
  });

  it("should return the parsed auth info for yet another valid auth header", () => {
    const header = 'Bearer realm="https://quay.io/v2/auth",service="quay.io"';
    const result = parseAuthHeader(header);
    expect(result).toEqual({
      realm: "https://quay.io/v2/auth",
      service: "quay.io",
    });
  });
});

describe("getToken", () => {
  it("should return the token for a valid image path and auth info", async () => {
    const result = await getToken({
      host: "docker.io",
      path: "nginx",
      tag: "latest",
    });

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThanOrEqual(28);
  });

  it("should return the token for a valid image path and auth info from another registry", async () => {
    const result = await getToken({
      host: "quay.io",
      path: "prometheus/node-exporter",
      tag: "latest",
    });

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThanOrEqual(28);
  });

  it("should return the token for a valid image path and auth info from yet another registry", async () => {
    const result = await getToken({
      host: "ghcr.io",
      path: "immich-app/immich-server",
      tag: "latest",
    });

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThanOrEqual(28);
  });

  it("should throw an error if the token cannot be retrieved", async () => {
    await expect(
      getToken({ host: "blaaa", path: "sadf", tag: "sadlofgkj" }),
    ).rejects.toThrowError();
  });
});

describe("getDigest", () => {
  it("should return the digest for a valid image", async () => {
    const image = {
      host: "docker.io",
      path: "nginx",
      tag: "latest",
    };
    const result = await getDigest(image);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(25);
  });

  it("should throw an error if the digest cannot be retrieved", async () => {
    const image = {
      host: "docker.io",
      path: "invalid-image",
      tag: "latest",
    };
    await expect(getDigest(image)).rejects.toThrowError();
  });
});
