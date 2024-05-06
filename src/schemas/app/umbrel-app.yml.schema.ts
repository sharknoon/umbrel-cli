import { z } from "zod";
import { isValidUrl } from "../../utils/net";
import { isCommunityAppStoreDirectory } from "../../utils/appstore";
import { getAllOfficialAppStorePorts } from "../../utils/global";

const usedPorts = await getAllOfficialAppStorePorts();

// Reference: https://github.com/getumbrel/umbrel/blob/master/packages/umbreld/source/modules/apps/schema.ts
export default z
  .object({
    // https://github.com/colinhacks/zod/pull/2980#issuecomment-2073499456
    manifestVersion: z
      .number()
      .refine((version) => version === 1 || version === 1.1, {
        message: "The manifest version can either be '1' or '1.1'",
      }),
    id: z.string().refine((id) => !id.startsWith("umbrel-app-store"), {
      message:
        "The id of the app can't start with 'umbrel-app-store' as it is the id of the app repository",
    }), // TODO also validate that the id doesn't start with the id of the custom app repository (if used)
    disabled: z.boolean().optional(),
    // enforce kebab case
    name: z.string().min(1).max(50),
    tagline: z.string().min(1).max(100),
    icon: z
      .string()
      .refine(
        async (icon) => {
          if (await isCommunityAppStoreDirectory()) {
            if (!icon) return false;
            return isValidUrl(icon);
          } else {
            if (!icon) return true;
            return (
              isValidUrl(icon) || /^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(icon)
            );
          }
        },
        {
          message:
            "The icon must be a valid URL or a relative path to a file in the app's directory.",
        }
      )
      .optional(),
    category: z.enum([
      "files",
      "bitcoin",
      "media",
      "networking",
      "social",
      "automation",
      "finance",
      "ai",
      "developer",
    ]),
    version: z.string().min(1),
    port: z.number().min(0).max(65535).refine((port) => !usedPorts.includes(port), {
      message: "The port is already in use by another app.",
    }),
    description: z.string().min(1).max(5000),
    developer: z.coerce.string().min(1).max(50),
    website: z.string().url(),
    submitter: z.coerce.string().min(1).max(50),
    submission: z.string().url(),
    repo: z.string().url().optional().or(z.literal("")),
    support: z.string().url(),
    gallery: z
      .string()
      .refine(
        async (image) => {
          if (await isCommunityAppStoreDirectory()) {
            return isValidUrl(image);
          } else {
            return /^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(image);
          }
        },
        {
          message: `The gallery images must be a ${
            (await isCommunityAppStoreDirectory())
              ? "valid URL"
              : "relative path to a file"
          }.`,
        }
      )
      .array(),
    releaseNotes: z.string().min(0).max(5000).optional().or(z.literal("")),
    dependencies: z.string().array().optional(),
    permissions: z.enum(["STORAGE_DOWNLOADS"]).array().optional(),
    path: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((path) => {
        if (!path) return true;
        return /^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(path);
      }),
    defaultUsername: z.string().optional().or(z.literal("")),
    defaultPassword: z.string().optional().or(z.literal("")),
    deterministicPassword: z.boolean().optional(),
    optimizedForUmbrelHome: z.boolean().optional(),
    torOnly: z.boolean().optional(),
    installSize: z.number().min(0).optional(),
    widgets: z.any().array().optional(), // TODO: Define this type
    defaultShell: z.string().optional(),
  })
  .refine((data) => !data.dependencies?.includes(data.id), {
    message: "Dependencies can't include its own app id",
  });
