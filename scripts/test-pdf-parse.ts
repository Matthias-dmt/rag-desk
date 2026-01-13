import { readFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

async function main() {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "sample.pdf");
  const buffer = await readFile(filePath);
  const module = (await import("pdf-parse")) as {
    PDFParse?: new (options: { data: Buffer; disableWorker?: boolean }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void>;
    };
  };

  if (!module.PDFParse) {
    throw new Error("PDFParse class not found in pdf-parse module");
  }

  if (typeof module.PDFParse.setWorker === "function") {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    );
    module.PDFParse.setWorker(pathToFileURL(workerPath).toString());
  }

  const parser = new module.PDFParse({ data: buffer, disableWorker: true });
  const parsed = await parser.getText();
  if (parser.destroy) {
    await parser.destroy();
  }

  console.log("Extracted PDF text:\n", parsed.text?.slice(0, 500) ?? "(empty)");
}

main().catch((error) => {
  console.error("PDF parse test failed:", error);
  process.exit(1);
});
