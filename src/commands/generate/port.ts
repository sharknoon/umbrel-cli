import { getUmbrelAppYmls } from "../../modules/apps";
import { getAppStoreType } from "../../modules/appstore";
import { officialAppStoreDir } from "../../modules/paths";
import { getRandomInt } from "../../utils/math";

export async function port() {
  const port = await generatePort();
  console.log(port);
}

export async function generatePort(): Promise<number> {
  const officialUmbrelAppYmls = await getUmbrelAppYmls({ dir: officialAppStoreDir });
  const officialPorts = officialUmbrelAppYmls.map((app) => app.port);
  let communityPorts: number[] = [];
  if ((await getAppStoreType()) === "community") {
    communityPorts = (await getUmbrelAppYmls()).map((app) => app.port);
  }
  const allPorts = officialPorts.concat(communityPorts);

  let port;
  do {
    port = getRandomInt(1024, 65535);
  } while (allPorts.includes(port));
  return port;
}
