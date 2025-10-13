import { z } from "zod";
import { isValidUrl } from "../utils/net";

export default async function umbrelAppYmlSchema() {
  // Reference: https://github.com/getumbrel/umbrel/blob/master/packages/umbreld/source/modules/apps/schema.ts
  return z
    .object({
      // https://github.com/colinhacks/zod/pull/2980#issuecomment-2073499456
      manifestVersion: z
        .number()
        .refine(
          (version) => version === 1 || version === 1.1 || version === 1.2,
          {
            error: "The manifest version can either be '1' or '1.1'",
          },
        ),
      id: z.string().refine((id) => !id.startsWith("umbrel-app-store"), {
        error:
          "The id of the app can't start with 'umbrel-app-store' as it is the id of the app repository",
      }), // TODO also validate that the id doesn't start with the id of the custom app repository (if used)
      disabled: z.boolean().optional(),
      // enforce kebab case
      name: z.string().min(1).max(50),
      tagline: z
        .string()
        .min(1)
        .max(100)
        .refine(
          async (tagline) =>
            // Check if the taglines do not end with a period (except for those with multiple periods in it)
            !(tagline.endsWith(".") && tagline.split(".").length === 2),
          {
            error: "Taglines should not end with a period",
          },
        ),
      icon: z.string().optional(),
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
      port: z.number().int().min(0).max(65535),
      description: z.string().min(1).max(5000),
      developer: z.preprocess((val) => {
        if (val === undefined || val === null) {
          return val;
        }
        return String(val);
      }, z.string().min(1).max(50)),
      website: z.url(),
      submitter: z.preprocess((val) => {
        if (val === undefined || val === null) {
          return val;
        }
        return String(val);
      }, z.string().min(1).max(50)),
      submission: z.url(),
      repo: z.union([z.url(), z.literal("")]).optional(),
      support: z.url(),
      gallery: z.string().array(),
      releaseNotes: z.string().min(0).max(5000).optional(),
      dependencies: z.string().array(),
      permissions: z.enum(["STORAGE_DOWNLOADS", "GPU"]).array().optional(),
      path: z
        .string()
        .refine((path) => isValidUrl(`https://example.com${path}`)),
      defaultUsername: z.string().optional().or(z.literal("")),
      defaultPassword: z.string().optional().or(z.literal("")),
      deterministicPassword: z.boolean().optional(),
      optimizedForUmbrelHome: z.boolean().optional(),
      torOnly: z.boolean().optional(),
      installSize: z.number().int().min(0).optional(),
      widgets: z.any().array().optional(), // TODO: Define this type
      defaultShell: z.string().optional(),
      backupIgnore: z.string().array().optional(),
    })
    .refine((data) => !data.dependencies?.includes(data.id), {
      error: "Dependencies can't include its own app id",
    });
}
