import { Client, ConnectConfig } from "ssh2";

export async function connect(
  client: Client,
  config: ConnectConfig
): Promise<void> {
  return new Promise((resolve, reject) => {
    client
      .on("ready", () => resolve())
      .connect(config)
      .on("error", (err) => reject(err));
  });
}

export async function exec(
  client: Client,
  command: string
): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";
      stream
        .on("data", (chunk: unknown) => (stdout += String(chunk)))
        .on("close", (code: number) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}`));
          } else {
            resolve({ stdout, stderr });
          }
        })
        .stderr.on("data", (chunk: unknown) => (stderr += String(chunk)));
    });
  });
}
