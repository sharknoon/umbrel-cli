import yaml, { CST, LineCounter, Parser } from "yaml";
import fs from "node:fs/promises";

export interface YamlSourceMap {
  line: { start: number; end: number }; // Starting at 1
  column?: { start: number; end: number }; // Starting at 1, only available if line.start === line.end
}

const content = await fs.readFile(
  "../umbrel-apps/portainer/docker-compose.yml",
  "utf-8"
);

const lineCounter = new LineCounter();
const parser = new Parser(lineCounter.addNewLine);
const [doc] = parser.parse(content);

const search = ["services", "docker", "image"];

function traverseCST(
  doc: CST.Token,
  search: string[]
): YamlSourceMap | undefined {
  switch (doc.type) {
    case "document":
      return traverseCST(doc.value as CST.Token, search);
    case "block-map":
      for (const item of doc.items) {
        if (item.key && "source" in item.key && item.key.source === search[0]) {
          // We have reached the end of our search
          if (search.length === 1) {
            const posKey = lineCounter.linePos(item.key.offset);
            if (item.value && "end" in item.value && item.value.end) {
              const posValue = lineCounter.linePos(item.value.offset);
              const posValueEnd = lineCounter.linePos(item.value.end[0].offset);
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
    case "block-seq":
      break;
  }
}

//lineCounter.lineStarts
//> [ 0, 5, 10, 17 ]
//lineCounter.linePos(3)
//> { line: 1, col: 4 }
//lineCounter.linePos(5)
//> { line: 2, col: 1 }

console.log(JSON.stringify(traverseCST(doc, search)));
