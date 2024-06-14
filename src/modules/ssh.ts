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
): Promise<{ code: number; result: string }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let result = "";
      stream
        .on("data", (chunk: unknown) => {
          result += String(chunk);
          process.stdout.write(String(chunk));
        })
        .on("close", (code: number) => {
          if (code !== 0) {
            reject(code);
          } else {
            resolve({ code, result });
          }
        })
        .stderr.on("data", (chunk) => process.stderr.write(String(chunk)));
    });
  });
}
