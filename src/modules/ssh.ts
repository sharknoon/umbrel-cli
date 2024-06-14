import { Client, ConnectConfig } from "ssh2";

export async function connect(client: Client, config: ConnectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
        client
            .on("ready", () => resolve())
            .connect(config)
            .on("error", (err) => reject(err));
    });
}

export async function exec(client: Client, command: string): Promise<number> {
    return new Promise((resolve, reject) => {
        client.exec(command, (err, stream) => {
            if (err) {
                reject(err);
                return;
            }

            stream
                .on("data", (chunk: unknown) => process.stdout.write(String(chunk)))
                .on("close", (code: number) => {
                    if (code !== 0) {
                        reject(code);
                    } else {
                        resolve(code);
                    }
                })
                .stderr.on("data", (chunk) => process.stderr.write(String(chunk))
                );
        });
    });
}