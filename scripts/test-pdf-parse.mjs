import { readFile } from "fs/promises";
import path from "path";
import { getPath } from "pdf-parse/worker";

const filePath = path.join(process.cwd(), "tests", "fixtures", "sample.pdf");
const buffer = await readFile(filePath);
import { PDFParse } from "pdf-parse";
import "pdf-parse/worker";
if (!PDFParse) {
  throw new Error("PDFParse class not found in pdf-parse module");
}

if (typeof PDFParse.setWorker === "function") {
  PDFParse.setWorker(getPath());
}

const parser = new PDFParse({ data: buffer });
const parsed = await parser.getText();
if (parser.destroy) {
  await parser.destroy();
}

console.log("Extracted PDF text:\n", parsed.text?.slice(0, 500) ?? "(empty)");
