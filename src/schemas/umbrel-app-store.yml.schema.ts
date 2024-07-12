import { z } from "zod";

export default async function umbrelAppStoreYmlSchema() {
  // Reference: https://github.com/getumbrel/umbrel/blob/master/packages/umbreld/source/modules/apps/schema.ts
  return z.object({
    id: z
      .string()
      .min(1)
      .max(50)
      .refine((id) => !id.startsWith("umbrel-app-store"), {
        message:
          "The id of the app can't start with 'umbrel-app-store' as it is the id of the official Umbrel App Store.",
      })
      .refine((id) => /^[a-z]+(?:-[a-z]+)*$/.test(id), {
        message:
          "The id of the app should contain only alphabets ('a' to 'z') and dashes ('-').",
      }),
    name: z.string().min(1).max(50),
  });
}
