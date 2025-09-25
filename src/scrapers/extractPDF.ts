import fs from "fs";
import pdfParse from "pdf-parse";

export async function extractPDFText(filePath: string) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);

  console.log("📄 Extracted Text (first 300 chars):", pdfData.text.slice(0, 300));
  return pdfData.text;
}
