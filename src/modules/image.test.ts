import { describe, it, expect } from "vitest";
import { parseImage } from "./image";

describe("parseImageTag", () => {
  it("should parse a complex image with host, path, tag and digest", async () => {
    const image =
      "ghcr.io/immich-app/immich-server:v1.105.1@sha256:658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228";
    const expected = {
      host: "ghcr.io",
      path: "immich-app/immich-server",
      tag: "v1.105.1",
      digest:
        "sha256:658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228",
    };
    expect(await parseImage(image)).toEqual(expected);
  });

  it("should parse image with host and path", async () => {
    const image = "docker.io/httpd";
    const expected = {
      host: "registry.hub.docker.com",
      path: "httpd",
      tag: undefined,
      digest: undefined,
    };
    expect(await parseImage(image)).toEqual(expected);
  });

  it("should parse image with path only", async () => {
    const image = "httpd";
    const expected = {
      host: "registry.hub.docker.com",
      path: "httpd",
      tag: undefined,
      digest: undefined,
    };
    expect(await parseImage(image)).toEqual(expected);
  });

  it("should throw an error for invalid image format", async () => {
    const image =
      "ghcr.io/immich-app/immich-server:v1.105.1@sha256658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228";
    expect(async () => await parseImage(image)).rejects.toThrowError(
      `Invalid image format: ${image}`,
    );
  });
});
