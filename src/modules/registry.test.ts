import { describe, it, expect } from "vitest";
import { getAuthInfo, getDigest, getManifest, getToken, parseAuthHeader } from "./registry";
import { Image } from "./image";

describe("getAuthInfo", () => {
  it("should return the RegistryInfo for a valid registry host", async () => {
    const result = await getAuthInfo(
      new Image({ host: "docker.io", path: "nginx" }),
    );
    expect(result.host).toEqual("registry.hub.docker.com");
    expect(result.auth).toBeTruthy();
    expect(result.auth?.realm).toEqual("https://auth.docker.io/token");
    expect(result.auth?.service).toEqual("registry.docker.io");
    expect(result.auth?.scope).toBeUndefined();
  });

  it("should return the RegistryInfo for another valid registry host", async () => {
    const result = await getAuthInfo(
      new Image({ host: "ghcr.io", path: "something" }),
    );
    expect(result.host).toEqual("ghcr.io");
    expect(result.auth).toBeTruthy();
    expect(result.auth?.realm).toEqual("https://ghcr.io/token");
    expect(result.auth?.service).toEqual("ghcr.io");
    expect(result.auth?.scope).toEqual("repository:user/image:pull");
  });

  it("should return the RegistryInfo for yet another valid registry host", async () => {
    const result = await getAuthInfo(
      new Image({ host: "quay.io", path: "something" }),
    );
    expect(result.host).toEqual("quay.io");
    expect(result.auth).toBeTruthy();
    expect(result.auth?.realm).toEqual("https://quay.io/v2/auth");
    expect(result.auth?.service).toEqual("quay.io");
    expect(result.auth?.scope).toBeUndefined();
  });

  it("should throw for an invalid registry host", async () => {
    expect(
      getAuthInfo(
        new Image({ host: "invalid.registry.com", path: "something" }),
      ),
    ).rejects.toThrowError();
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
    const result = await getToken(
      new Image({
        host: "docker.io",
        path: "nginx",
        tag: "latest",
      }),
    );

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThanOrEqual(28);
  });

  it("should return the token for a valid image path and auth info from another registry", async () => {
    const result = await getToken(
      new Image({
        host: "quay.io",
        path: "prometheus/node-exporter",
        tag: "latest",
      }),
    );

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThanOrEqual(28);
  });

  it("should return the token for a valid image path and auth info from yet another registry", async () => {
    const result = await getToken(
      new Image({
        host: "ghcr.io",
        path: "immich-app/immich-server",
        tag: "latest",
      }),
    );

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThanOrEqual(28);
  });

  it("should throw an error if the token cannot be retrieved", async () => {
    await expect(
      getToken(new Image({ host: "blaaa", path: "sadf", tag: "sadlofgkj" })),
    ).rejects.toThrowError();
  });
});

describe("getDigest", () => {
  it("should return the digest for a valid image", async () => {
    const image = new Image({
      host: "docker.io",
      path: "nginx",
      tag: "latest",
    });
    const result = await getDigest(image);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(25);
    console.log(result);
  });

  it("should throw an error if the digest cannot be retrieved", async () => {
    const image = new Image({
      host: "docker.io",
      path: "invalid-image",
      tag: "latest",
    });
    await expect(getDigest(image)).rejects.toThrowError();
  });
});

describe("getManifest", () => {
  it("should return the manifest for a valid image", async () => {
    const image = new Image({
      host: "docker.io",
      path: "nginx",
      tag: "latest",
    });
    const result = await getManifest(image);
    expect(result).toBeTruthy();
    expect(result.schemaVersion).toBe(2);
    expect(result.mediaType).toBe("application/vnd.oci.image.index.v1+json");
    //expect(result.config).toBeTruthy();
    //expect(result.layers).toBeTruthy();
  });

  it("should throw an error if the manifest cannot be retrieved", async () => {
    const image = new Image({
      host: "docker.io",
      path: "invalid-image",
      tag: "latest",
    });
    await expect(getManifest(image)).rejects.toThrowError();
  });
});