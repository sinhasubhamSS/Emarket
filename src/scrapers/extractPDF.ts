import fs from "fs";
import pdfParse from "pdf-parse";
import { fromPath } from "pdf2pic";
import Tesseract from "tesseract.js";

// Extract text (tries pdf-parse first, then OCR fallback)
export async function extractPDFText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);

  let text = pdfData.text.trim();
  console.log("📄 PDF-Parse Extracted (first 200 chars):", text.slice(0, 200));

  // Fallback to OCR if extracted text looks empty or garbled
  if (text.length < 100 || !/[a-zA-Z0-9]/.test(text)) {
    console.log("⚠️ PDF seems image-based → running OCR...");

    // Convert first page to PNG
    const converter = fromPath(filePath, {
      density: 200,
      saveFilename: "ocr_page",
      savePath: "./temp_images",
      format: "png",
      width: 1200,
      height: 1600,
    });

    const page1 = await converter(1); // Convert first page

    if (!page1.path) {
      throw new Error("❌ Could not generate image for OCR");
    }

    const result = await Tesseract.recognize(page1.path, "eng+hin"); // English + Hindi
    text = result.data.text.trim();

    console.log("📝 OCR Extracted (first 200 chars):", text.slice(0, 200));
  }

  return text;
}

// Regex based field extraction
export function extractRelevantFields(rawText: string) {
  // Clean text: remove non-ASCII chars to skip Hindi + weird symbols
  const cleanedText = rawText.replace(/[^\x00-\x7F]+/g, " ");

  const itemCategoryMatch = cleanedText.match(
    /Item\s*Category\s*[:\-]?\s*(.+)/i
  );
  const startDateMatch = cleanedText.match(
    /Bid\s*Start\s*Date.*?(\d{2}-\d{2}-\d{4})/i
  );
  const endDateMatch = cleanedText.match(
    /Bid\s*End\s*Date.*?(\d{2}-\d{2}-\d{4})/i
  );
  const emdAmountMatch = cleanedText.match(/EMD\s*Amount\s*[:\-]?\s*([\d,]+)/i);

  const extracted = {
    itemCategory: itemCategoryMatch ? itemCategoryMatch[1].trim() : null,
    startDate: startDateMatch ? startDateMatch[1] : null,
    endDate: endDateMatch ? endDateMatch[1] : null,
    emdAmount: emdAmountMatch ? emdAmountMatch[1] : null,
  };

  console.log("🗂️ Extracted Fields:", extracted);
  return extracted;
}
