import fs from "fs";
import pdfParse from "pdf-parse";
import { fromPath } from "pdf2pic";
import Tesseract from "tesseract.js";

// -------------------------------
// Step 1: Extract text (pdf-parse + OCR fallback)
// -------------------------------
export async function extractPDFText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);

  let text = pdfData.text.trim();
  console.log("📄 PDF-Parse Extracted (first 200 chars):", text.slice(0, 200));

  // OCR fallback if little or no text
  if (text.length < 100 || !/[a-zA-Z0-9]/.test(text)) {
    console.log("⚠️ PDF seems image-based → running OCR...");

    const converter = fromPath(filePath, {
      density: 200,
      saveFilename: "ocr_page",
      savePath: "./temp_images",
      format: "png",
      width: 1200,
      height: 1600,
    });

    const page1 = await converter(1);
    if (!page1.path) throw new Error("❌ Could not generate image for OCR");

    const result = await Tesseract.recognize(page1.path, "eng+hin");
    text = result.data.text.trim();

    console.log("📝 OCR Extracted (first 200 chars):", text.slice(0, 200));
  }

  return text;
}

// -------------------------------
// Helpers for cleaning & deduplication
// -------------------------------
function cleanConsigneeAddress(addr: string): string {
  return (
    addr
      .replace(/ITEM\s*\d+/gi, "") // remove “ITEM <number>”
      .replace(/\b\d{2,4}\b/g, "") // remove isolated small numbers like 660, 160, 260
      .replace(/[^a-zA-Z0-9,.\-()\s]/g, " ") // remove weird/special characters
      .replace(/\s+/g, " ") // collapse multiple spaces
      .trim()
      // optional: if you want to cut off after a known phrase, e.g. “Post Chirkunda”
      .replace(/(Post Chirkunda).*/i, "Post Chirkunda")
  );
}

function getUniqueCleanConsignees(rawConsignees: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const addr of rawConsignees) {
    const cleaned = cleanConsigneeAddress(addr);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      unique.push(cleaned);
    }
  }

  // If you want to allow multiple, return all unique.
  // But as per your requirement, only one is enough:
  if (unique.length > 0) {
    return [unique[0]];
  }
  return [];
}

// -------------------------------
// Step 2: Extract Relevant Fields
// -------------------------------
export function extractRelevantFields(
  rawText: string,
  tenderId: number,
  bidNumber: string
) {
  const pdfUrl = `https://bidplus.gem.gov.in/showbidDocument/${tenderId}`;
  const cleanedText = rawText.replace(/[^\x00-\x7F]+/g, " ");

  // Core fields extraction
  const bidNumberMatch = cleanedText.match(
    /Bid\s*Number[:\-]?\s*(GEM\/\d{4}\/B\/\d+)/i
  );
  const startDateMatch = cleanedText.match(
    /Dated[:\-]?\s*(\d{2}-\d{2}-\d{4})/i
  );
  const endDateMatch = cleanedText.match(
    /Bid\s*End\s*Date\/Time\s*(\d{2}-\d{2}-\d{4}\s*\d{2}:\d{2}:\d{2})/i
  );
  const itemCategoryMatch = cleanedText.match(
    /Item\s*Category\s*[:\-]?\s*([\s\S]*?)(?=GeMARPTS|Document|required|$)/i
  );
  const documentReqMatch = cleanedText.match(
    /Document\s*required\s*from\s*seller\s*[:\-]?\s*([\s\S]*?)(?=In case|Consignee|$)/i
  );

  // Extract consignee blocks
  const consigneeBlockRegex =
    /Consignees?[\s\S]*?(?=(?:Technical Specifications|Buyer Added|Scope of Supply|Disclaimer|$))/gi;
  const consigneeBlocks = cleanedText.match(consigneeBlockRegex) || [];

  const rawConsignees: string[] = [];
  for (const block of consigneeBlocks) {
    const addressRegex =
      /\d{6},\s*[\s\S]*?(?=(?:\d+\s+\d+|Delivery|Quantity|$))/g;
    const matches = block.match(addressRegex);
    if (matches) {
      for (const m of matches) {
        rawConsignees.push(m.replace(/\s+/g, " ").trim());
      }
    }
  }

  // Clean + dedupe
  const uniqueConsignees = getUniqueCleanConsignees(rawConsignees);

  console.log(
    "📄 Total Unique Clean Consignee Addresses:",
    uniqueConsignees.length
  );

  const extracted = {
    bidNumber: bidNumber || null, // From API ✅
    // Direct link
    startDate: startDateMatch ? startDateMatch[1] : null,
    endDate: endDateMatch ? endDateMatch[1].trim() : null,
    itemCategory: itemCategoryMatch
      ? itemCategoryMatch[1].replace(/\s+/g, " ").trim()
      : null,
    documentsRequired: documentReqMatch
      ? documentReqMatch[1].replace(/\s+/g, " ").trim()
      : null,
    consignees: uniqueConsignees.length > 0 ? uniqueConsignees : null,
    pdfdownload: pdfUrl,
  };

  console.log("🗂️ Extracted Fields:", extracted);
  return extracted;
}
