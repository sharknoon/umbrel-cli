import { describe, expect, it } from "vitest";
import { mockVariables } from "./mock";

const exampleDockerCompose = `version: "3.7"

services:
  app_proxy:
    environment:
      APP_HOST: $APP_BITCOIN_IP
      APP_PORT: 3005
  
  server:
    image: getumbrel/umbrel-bitcoin:v0.7.0@sha256:f2bb98c962fbad13991ceeda1308bbfaca13cc7cd5cb7d6b2e0d1d06e6123072
    depends_on: [bitcoind]
    restart: on-failure
    volumes:
      - \${APP_DATA_DIR}/data/app:/data # volume to persist advanced settings json
      - \${APP_BITCOIN_DATA_DIR}:/bitcoin/.bitcoin # volume to persist umbrel-bitcoin.conf and bitcoin.conf
    environment:
      PORT: "3005"
      BITCOIN_HOST: "\${APP_BITCOIN_NODE_IP}"
      RPC_PORT: "\${APP_BITCOIN_RPC_PORT}"
      BITCOIN_RPC_PORT: "\${APP_BITCOIN_RPC_PORT}"
      RPC_USER: "\${APP_BITCOIN_RPC_USER}"
      BITCOIN_RPC_USER: "\${APP_BITCOIN_RPC_USER}"
      RPC_PASSWORD: "\${APP_BITCOIN_RPC_PASS}"
      BITCOIN_RPC_PASSWORD: "\${APP_BITCOIN_RPC_PASS}"
      BITCOIN_RPC_HIDDEN_SERVICE: "\${APP_BITCOIN_RPC_HIDDEN_SERVICE}"
      BITCOIN_P2P_HIDDEN_SERVICE: "\${APP_BITCOIN_P2P_HIDDEN_SERVICE}"
      BITCOIN_P2P_PORT: "\${APP_BITCOIN_P2P_PORT}"
      DEVICE_DOMAIN_NAME: "\${DEVICE_DOMAIN_NAME}"
      BITCOIN_DEFAULT_NETWORK: "\${BITCOIN_DEFAULT_NETWORK:-mainnet}"
      BITCOIN_INITIALIZE_WITH_CLEARNET_OVER_TOR: "\${BITCOIN_INITIALIZE_WITH_CLEARNET_OVER_TOR:-unset}"
      BITCOIND_IP: "\${APP_BITCOIN_NODE_IP}"
      TOR_PROXY_IP: "\${APP_BITCOIN_TOR_PROXY_IP}"
      TOR_PROXY_PORT: "9050"
      TOR_PROXY_CONTROL_PORT: "9051"
      TOR_PROXY_CONTROL_PASSWORD: "moneyprintergobrrr"
      I2P_DAEMON_IP: "\${APP_BITCOIN_I2P_DAEMON_IP}"
      I2P_DAEMON_PORT: "7656"
    networks:
      default:
        ipv4_address: $APP_BITCOIN_IP

  bitcoind:
    image: lncm/bitcoind:v27.0@sha256:324fec72192e8a1c7b79e7ab91003e47678b808d46da2c1943e72ec212ab348f
    command: "\${APP_BITCOIN_COMMAND}"
    restart: unless-stopped
    stop_grace_period: 15m30s
    volumes:
      - "\${APP_BITCOIN_DATA_DIR}:/data/.bitcoin"
    ports:
      - "\${APP_BITCOIN_P2P_PORT}:\${APP_BITCOIN_P2P_PORT}"
      - "\${APP_BITCOIN_RPC_PORT}:\${APP_BITCOIN_RPC_PORT}"
    networks:
      default:
        ipv4_address: $APP_BITCOIN_NODE_IP

  tor:
    image: getumbrel/tor:0.4.7.8@sha256:2ace83f22501f58857fa9b403009f595137fa2e7986c4fda79d82a8119072b6a
    user: "1000:1000"
    restart: on-failure
    volumes:
      - \${APP_DATA_DIR}/torrc:/etc/tor/torrc:ro
      - \${TOR_DATA_DIR}:/data
    environment:
      HOME: "/tmp"
    networks:
      default:
        ipv4_address: "\${APP_BITCOIN_TOR_PROXY_IP}"
  
  i2pd_daemon:
    image: purplei2p/i2pd:release-2.44.0@sha256:d154a599793c393cf9c91f8549ba7ece0bb40e5728e1813aa6dd4c210aa606f6
    user: "root"
    command: --sam.enabled=true --sam.address=0.0.0.0 --sam.port=7656 --loglevel=error
    restart: on-failure
    volumes:
      - \${APP_DATA_DIR}/data/i2pd:/home/i2pd/data
    networks:
      default:
        ipv4_address: "\${APP_BITCOIN_I2P_DAEMON_IP}"`;

describe("mockVariables", () => {
  it("should replace variables with their corresponding mocks", async () => {
    const result = await mockVariables(exampleDockerCompose);

    expect(result).not.toMatch(/(\$\{?[a-zA-Z0-9-_]+\}?)/g);
  });

  it("should replace multiple variables with their corresponding mocks", async () => {
    const input =
      "Username: $APP_USER, Password: $APP_PASS, Directory: $DATA_DIR";
    const expectedOutput =
      "Username: username, Password: password, Directory: /path/to/dir";

    const result = await mockVariables(input);

    expect(result).toBe(expectedOutput);
  });

  it("should replace unknown variables with 'mocked'", async () => {
    const input = "This is a $UNKNOWN_VARIABLE";
    const expectedOutput = "This is a mocked";

    const result = await mockVariables(input);

    expect(result).toBe(expectedOutput);
  });
});
