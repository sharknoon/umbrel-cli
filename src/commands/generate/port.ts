import { getUmbrelAppYmls } from "../../modules/apps";
import { getAppStoreType } from "../../modules/appstore";
import { getRandomInt } from "../../utils/math";

export async function port() {
  const officialPorts = (await getUmbrelAppYmls()).map((app) => app.port);
  let communityPorts: number[] = [];
  if ((await getAppStoreType()) === "community") {
    communityPorts = (await getUmbrelAppYmls()).map((app) => app.port);
  }
  const ports = officialPorts.concat(communityPorts);

  let port;
  do {
    port = getRandomInt(1024, 65535);
  } while (ports.includes(port));
  console.log(port);
}
