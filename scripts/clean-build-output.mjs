import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = resolve(process.cwd(), "dist");

if (existsSync(outputDir)) {
  rmSync(outputDir, { recursive: true, force: true });
}
mkdirSync(outputDir, { recursive: true });
console.log(`Diretório de build limpo: ${outputDir}`);
