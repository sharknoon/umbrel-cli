export interface YamlSourceMap {
    line?: { start: number, end: number }, // Starting at 1
    column?: { start: number, end: number }, // Starting at 1
}

export function getSourceMapForKey(yaml: string, keys: (string | number)[]): YamlSourceMap {
    return { line: { start: 1, end: 2 }, column: { start: 1, end: 2 } }
}