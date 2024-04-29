import * as p from "@clack/prompts";
import color from "picocolors";
import path from "node:path";
import fs from "node:fs/promises";

export async function createAppstore() {
  console.clear();

  p.intro(`${color.bgBlue(color.white(" Umbrel CLI "))}`);

  const project = await p.group(
    {
      path: () =>
        p.text({
          message:
            'Where should we create the appstore? The path should contain only alphabets ("a to z") and dashes ("-")',
          placeholder: "./umbrel-app-store",
          initialValue: "./umbrel-app-store",
          validate: (value) => {
            if (!value) return "Please enter a path.";
            if (value[0] !== ".") return "Please enter a relative path.";
            if (!/^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(value))
              return "Please enter a valid path.";
          },
        }),
      id: () =>
        p.text({
          message:
            'Choose the ID for your app store. This should contain only alphabets ("a to z") and dashes ("-").',
          placeholder: "sharknoon",
          validate: (value) => {
            if (!value) return "Please enter an ID.";
            if (!/^[a-z]+(?:-[a-z]+)*$/.test(value))
              return "Please enter a valid ID.";
            if (value === "umbrel-app-store")
              return "Please choose a different ID.";
          },
        }),
      name: () =>
        p.text({
          message:
            'Choose the name of your app store. It will show up in the UI as "<name> App Store".',
          placeholder: "Sharknoons",
          validate: (value) => {
            if (!value) return "Please enter a name.";
          },
        }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  // project directory
  project.path = path.resolve(project.path);
  await fs.mkdir(project.path, { recursive: true });

  // umbrel-app-store.yml
  const umbrelAppStoreYml = `id: ${project.id} # Choose the ID for your app store. This should contain only alphabets ("a to z") and dashes ("-").\nname: "${project.name}" # Choose the name of your app store. It will show up in the UI as "<name> App Store".`;
  await fs.writeFile(
    path.join(project.path, "umbrel-app-store.yml"),
    umbrelAppStoreYml,
    "utf-8"
  );

  // .gitignore
  const gitignore = `.DS_Store`;
  await fs.writeFile(path.join(project.path, ".gitignore"), gitignore, "utf-8");

  // README.md
  const readme = `# ${project.name} App Store\n\nThis is a community app store for [Umbrel](https://umbrel.com). It was generated using the [Umbrel CLI](https://npmjs.org/package/umbrel)`;
  await fs.writeFile(path.join(project.path, "README.md"), readme, "utf-8");

  let nextSteps = `cd ${path.relative("", project.path)}\numbrel create app`;

  p.note(nextSteps, "Next steps.");

  p.outro(
    `Problems? ${color.underline(
      color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
    )}`
  );
}
