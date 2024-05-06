import {
  getAllAppStorePorts,
  isCommunityAppStoreDirectory,
} from "../../utils/appstore";
import { getAllOfficialAppStorePorts } from "../../utils/global";
import { getRandomInt } from "../../utils/math";

export async function port() {
  const officialPorts = await getAllOfficialAppStorePorts();
  let communityPorts: number[] = [];
  if (await isCommunityAppStoreDirectory()) {
    communityPorts = await getAllAppStorePorts();
  }
  const ports = officialPorts.concat(communityPorts);

  let port;
  do {
    port = getRandomInt(1024, 65535);
  } while (ports.includes(port));
  console.log(port);
}
