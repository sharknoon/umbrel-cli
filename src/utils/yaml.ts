import { CST, LineCounter, Parser } from "yaml";

export interface YamlSourceMap {
  line: { start: number; end: number }; // Starting at 1
  column?: { start: number; end: number }; // Starting at 1, only available if line.start === line.end
}

export function getSourceMapForKey(
  content: string,
  search: (string | number)[],
): YamlSourceMap | undefined {
  const lineCounter = new LineCounter();
  const parser = new Parser(lineCounter.addNewLine);
  const [doc] = parser.parse(content);

  function traverseCST(
    doc: CST.Token,
    search: (string | number)[],
  ): YamlSourceMap | undefined {
    switch (doc.type) {
      case "document":
        return traverseCST(doc.value as CST.Token, search);
      case "block-map":
        for (const item of doc.items) {
          if (
            item.key &&
            "source" in item.key &&
            item.key.source === search[0]
          ) {
            // We have reached the end of our search
            if (search.length === 1) {
              const posKey = lineCounter.linePos(item.key.offset);
              if (
                item.value &&
                "end" in item.value &&
                item.value.end &&
                item.value.end[0]
              ) {
                const posValue = lineCounter.linePos(item.value.offset);
                const posValueEnd = lineCounter.linePos(
                  item.value.end[0].offset,
                );
                if (posKey.line === posValueEnd.line) {
                  return {
                    line: { start: posKey.line, end: posKey.line },
                    column: { start: posValue.col, end: posValueEnd.col },
                  };
                } else {
                  return {
                    line: { start: posKey.line, end: posValueEnd.line },
                  };
                }
              } else {
                return { line: { start: posKey.line, end: posKey.line } };
              }
            } else if (item.value) {
              // Remove the found item from the search
              search.splice(0, 1);
              return traverseCST(item.value, search);
            }
            // The search is too long, we have no value, but the search array continues
            return undefined;
          }
        }
        break;
      case "block-seq": {
        const searchIndex = parseInt(String(search[0]));
        // The search index is not a number
        if (isNaN(searchIndex)) {
          return undefined;
        }
        // The search index is out of bounds
        if (searchIndex < 0 || searchIndex >= doc.items.length) {
          return undefined;
        }
        const item = doc.items[searchIndex];
        if (item && item.value) {
          // We have reached the end of our search
          if (search.length === 1) {
            const posValue = lineCounter.linePos(item.value.offset);
            if ("end" in item.value && item.value.end && item.value.end[0]) {
              const posValueEnd = lineCounter.linePos(item.value.end[0].offset);
              if (posValue.line === posValueEnd.line) {
                return {
                  line: { start: posValue.line, end: posValue.line },
                  column: { start: posValue.col, end: posValueEnd.col },
                };
              } else {
                return {
                  line: { start: posValue.line, end: posValueEnd.line },
                };
              }
            } else {
              return { line: { start: posValue.line, end: posValue.line } };
            }
          } else if (item.value) {
            // Remove the found item from the search
            search.splice(0, 1);
            return traverseCST(item.value, search);
          }
        } else {
          return undefined;
        }
        break;
      }
    }
  }

  return traverseCST(doc, search);
}
