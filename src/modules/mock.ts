export async function mockVariables(input: string) {
  const variables = extractVariables(input);
  const mockedVariables = findMocks(variables);
  return replaceVariables(input, mockedVariables);
}

interface Variable {
  fullVariable: string;
  variable: string;
  mock: string;
}

function extractVariables(input: string): Variable[] {
  const variables = input.matchAll(/\$(?:(\w+)|\{(\w+)\})/g);
  return [...variables].map((v) => ({
    fullVariable: v[0],
    variable: v[1] ?? v[2],
    mock: "",
  }));
}

function findMocks(variables: Variable[]) {
  for (const v of variables) {
    if (v.variable.includes("_IP")) {
      v.mock = "10.10.10.10";
    } else if (v.variable.includes("_PORT")) {
      // Random port between 1024 and 65535 to make json schema happy
      v.mock = Math.floor(Math.random() * (65535 - 1024 + 1) + 1024).toString();
    } else if (v.variable.includes("_PASS")) {
      v.mock = "password";
    } else if (v.variable.includes("_USER")) {
      v.mock = "username";
    } else if (v.variable.includes("_DIR")) {
      v.mock = "/path/to/dir";
    } else if (v.variable.includes("_PATH")) {
      v.mock = "/some/path";
    } else if (v.variable.includes("_SERVICE")) {
      v.mock = "service";
    } else if (v.variable.includes("_SEED")) {
      v.mock = "seed";
    } else if (v.variable.includes("_CONFIG")) {
      v.mock = "/path/to/config";
    } else if (v.variable.includes("_MODE")) {
      v.mock = "production";
    } else if (v.variable.includes("_NETWORK")) {
      v.mock = "network";
    } else if (v.variable.includes("_DOMAIN")) {
      v.mock = "domain.com";
    } else if (v.variable.includes("_NAME")) {
      v.mock = "name";
    } else if (v.variable.includes("_VERSION")) {
      v.mock = "1.0.0";
    } else if (v.variable.includes("_ROOT")) {
      v.mock = "/path/to/root";
    } else if (v.variable.includes("_KEY")) {
      v.mock = "key";
    } else if (v.variable.includes("_SECRET")) {
      v.mock = "secret";
    } else if (v.variable.includes("_TOKEN")) {
      v.mock = "token";
    } else if (v.variable.includes("_HOST")) {
      v.mock = "host";
    } else {
      v.mock = "mocked";
    }
  }
  return variables;
}

function replaceVariables(input: string, variables: Variable[]) {
  for (const variable of variables) {
    input = input.replace(variable.fullVariable, variable.mock);
  }
  return input;
}
