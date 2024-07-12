import { describe, it, expect } from "vitest";
import { Image } from "./image";

describe("Image.fromString(image)", () => {
  it("should resolve a complex image with host, path, tag and digest", async () => {
    const image =
      "ghcr.io/immich-app/immich-server:v1.105.1@sha256:658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228";
    const expected = {
      host: "ghcr.io",
      path: "immich-app/immich-server",
      tag: "v1.105.1",
      digest:
        "sha256:658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228",
    };
    expect(await Image.fromString(image)).toEqual(expected);
  });

  it("should resolve a complex image with path, tag and digest", async () => {
    const image =
      "docker:24.0.5-dind@sha256:3c6e4dca7a63c9a32a4e00da40461ce067f255987ccc9721cf18ffa087bcd1ef";
    const expected = {
      host: "registry.hub.docker.com",
      path: "docker",
      tag: "24.0.5-dind",
      digest:
        "sha256:3c6e4dca7a63c9a32a4e00da40461ce067f255987ccc9721cf18ffa087bcd1ef",
    };
    expect(await Image.fromString(image)).toEqual(expected);
  });

  it("should resolve image with host and path", async () => {
    const image = "docker.io/httpd";
    const expected = {
      host: "registry.hub.docker.com",
      path: "httpd",
      tag: "latest",
      digest: undefined,
    };
    expect(await Image.fromString(image)).toEqual(expected);
  });

  it("should resolve image with path only", async () => {
    const image = "httpd";
    const expected = {
      host: "registry.hub.docker.com",
      path: "httpd",
      tag: "latest",
      digest: undefined,
    };
    expect(await Image.fromString(image)).toEqual(expected);
  });

  it("should throw an error for invalid image format", async () => {
    const image =
      "ghcr.io/immich-app/immich-server:v1.105.1@sha256658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228";
    expect(async () => await Image.fromString(image)).rejects.toThrowError(
      `Invalid image format: ${image}`,
    );
  });
});
