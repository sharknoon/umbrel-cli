import pc from "picocolors"

export const MESSAGE_ABORTED = "🚫 Aborted";
export function printAborted() {
    console.log(pc.red(pc.bold(MESSAGE_ABORTED)));
}

export const MESSAGE_ERROR_OCCURED = "🚨 An Error occured: ";
export function printErrorOccured(error: unknown) {
    console.log(`${pc.red(MESSAGE_ERROR_OCCURED)}: ${error}`)
}