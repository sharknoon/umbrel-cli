export async function catchStdout(callback: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  let output = "";
  console.log = (str) => {
    output += str + "\n";
  };
  console.error = (str) => {
    output += str + "\n";
  };
  console.warn = (str) => {
    output += str + "\n";
  };
  console.info = (str) => {
    output += str + "\n";
  };
  console.debug = (str) => {
    output += str + "\n";
  };
  try {
    await callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.debug = originalDebug;
  }
  return output;
}