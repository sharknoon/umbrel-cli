import { describe, it, expect } from "vitest";
import { Image } from "./image";

describe("Image.fromString(image)", () => {
  it("should resolve a complex image with host, path, tag and digest", async () => {
    const image =
      "ghcr.io/immich-app/immich-server:v1.105.1@sha256:658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228";
    const result = await Image.fromString(image);
    expect(result.host).toEqual("ghcr.io");
    expect(result.APIHost).toEqual("ghcr.io");
    expect(result.path).toEqual("immich-app/immich-server");
    expect(result.APIPath).toEqual("immich-app/immich-server");
    expect(result.tag).toEqual("v1.105.1");
    expect(await result.digest()).toEqual(
      "sha256:658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228",
    );
  });

  it("should resolve a complex image with path, tag and digest", async () => {
    const image =
      "docker:24.0.5-dind@sha256:3c6e4dca7a63c9a32a4e00da40461ce067f255987ccc9721cf18ffa087bcd1ef";
    const result = await Image.fromString(image);
    expect(result.host).toEqual("docker.io");
    expect(result.APIHost).toEqual("registry.hub.docker.com");
    expect(result.path).toEqual("docker");
    expect(result.APIPath).toEqual("library/docker");
    expect(result.tag).toEqual("24.0.5-dind");
    expect(await result.digest()).toEqual(
      "sha256:3c6e4dca7a63c9a32a4e00da40461ce067f255987ccc9721cf18ffa087bcd1ef",
    );
  });

  it("should resolve image with host and path", async () => {
    const image = "docker.io/httpd";
    const result = await Image.fromString(image);
    expect(result.host).toEqual("docker.io");
    expect(result.APIHost).toEqual("registry.hub.docker.com");
    expect(result.path).toEqual("httpd");
    expect(result.APIPath).toEqual("library/httpd");
    expect(result.tag).toEqual("latest");
    //expect(await result.digest()).toEqual(undefined);
  });

  it("should resolve image with path only", async () => {
    const image = "httpd";
    const result = await Image.fromString(image);
    expect(result.host).toEqual("docker.io");
    expect(result.APIHost).toEqual("registry.hub.docker.com");
    expect(result.path).toEqual("httpd");
    expect(result.APIPath).toEqual("library/httpd");
    expect(result.tag).toEqual("latest");
    expect((await result.digest()).startsWith("sha256")).toBeTruthy();
  });

  it("should throw an error for invalid image format", async () => {
    const image =
      "ghcr.io/immich-app/immich-server:v1.105.1@sha256658b40420d7a39d6eb34c797cec8d36ff315f5adb168301aaf27dc4eafc8e228";
    expect(async () => await Image.fromString(image)).rejects.toThrowError(
      `Invalid image format: ${image}`,
    );
  });
});
