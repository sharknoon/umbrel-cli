import { read } from "read";
import { Client } from "ssh2";
import pc from "picocolors";

export async function test(cwd: string, host: string): Promise<number> {
  const conn = new Client();
  const password = await read({
    prompt: "Please enter the password for your Umbrel: ",
    silent: true,
    replace: "*",
  });
  return new Promise((resolve, reject) => {
    conn
      .on("ready", () => {
        console.log(pc.green("🎉 Successfully connected to Umbrel"));
        conn.exec("uptime", (err, stream) => {
          if (err) throw err;
          stream
            .on("close", (code, signal) => {
              const color = code === 0 ? pc.green : pc.red;
              console.log(
                color(
                  "❌ Connection closed with exit code " +
                    pc.bold(code) +
                    (signal ? " and signal " + pc.bold(signal) : "")
                )
              );
              conn.end();
            })
            .on("data", (data) => {
              console.log("STDOUT: " + data);
            })
            .stderr.on("data", (data) => {
              console.log("STDERR: " + data);
            });
        });
      })
      .connect({
        host,
        port: 22,
        username: "umbrel",
        password,
      })
      .on("error", (err) => {
        console.error(
          pc.red(pc.bold("🚨 Error connecting to Umbrel: ")) + err.message
        );
      });
  });
}
