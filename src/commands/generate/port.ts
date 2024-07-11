import { getValidatedUmbrelAppYmls } from "../../modules/apps";
import { getAppStoreType } from "../../modules/appstore";
import { officialAppStoreDir } from "../../modules/paths";
import { getRandomInt } from "../../utils/math";

export async function port(cwd: string) {
  const port = await generatePort(cwd);
  console.log(port);
}

export async function generatePort(cwd: string): Promise<number> {
  const officialUmbrelAppYmls =
    await getValidatedUmbrelAppYmls(officialAppStoreDir);
  const officialPorts = officialUmbrelAppYmls.map((app) => app.port);
  let communityPorts: number[] = [];
  if ((await getAppStoreType(cwd)) === "community") {
    communityPorts = (await getValidatedUmbrelAppYmls(cwd)).map(
      (app) => app.port,
    );
  }
  const allPorts = officialPorts.concat(communityPorts);

  let port;
  do {
    port = getRandomInt(1024, 65535);
  } while (allPorts.includes(port));
  return port;
}
