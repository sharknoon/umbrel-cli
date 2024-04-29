import { z } from "zod";

// Reference: https://github.com/getumbrel/umbrel/blob/master/packages/umbreld/source/modules/apps/schema.ts
export const appManifest = z.object({
  // https://github.com/colinhacks/zod/pull/2980#issuecomment-2073499456
  manifestVersion: z
    .number()
    .refine((version) => version === 1 || version === 1.1, {
      message: "The manifest version can either be '1' or '1.1'",
    }),
  id: z.string().refine((id) => id.startsWith("umbrel-app-store"), {
    message:
      "The id of the app can't start with 'umbrel-app-store' as it is the id of the app repository",
  }), // TODO also validate that the id doesn't start with the id of the custom app repository (if used)
  disabled: z.boolean().optional(),
  // enforce kebab case
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tagline: z.string(),
  icon: z.string(),
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
  version: z.string(),
  port: z.number().min(0).max(65535),
  description: z.string(),
  developer: z.string(),
  website: z.string().url(),
  submitter: z.string(),
  submission: z.string(),
  repo: z.string().optional(),
  support: z.string(),
  gallery: z.string().array(),
  releaseNotes: z.string().optional(),
  dependencies: z.string().array().optional(),
  permissions: z.string().array().optional(),
  path: z.string().optional(),
  defaultUsername: z.string().optional(),
  defaultPassword: z.string().optional(),
  deterministicPassword: z.boolean().optional(),
  optimizedForUmbrelHome: z.boolean().optional(),
  torOnly: z.boolean().optional(),
  /** In bytes */
  installSize: z.number().optional(),
  widgets: z.any().array().optional(), // TODO: Define this type
  defaultShell: z.string().optional(),
});
