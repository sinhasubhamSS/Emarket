import fs from "fs";
import pdfParse from "pdf-parse";
import { fromPath } from "pdf2pic";
import Tesseract from "tesseract.js";

// Extract text (first try pdf-parse, then OCR fallback)
export async function extractPDFText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);

  let text = pdfData.text.trim();
  console.log("📄 PDF-Parse Extracted (first 200 chars):", text.slice(0, 200));

  // OCR fallback
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


// Step 2: Extract Relevant Fields
// -------------------------------
export function extractRelevantFields(rawText: string) {
  const cleanedText = rawText.replace(/[^\x00-\x7F]+/g, " ");

  // Core fields extraction
  const bidNumberMatch = cleanedText.match(
    /Bid\s*Number[:\-]?\s*(GEM\/\d{4}\/B\/\d+)/i
  );
  const startDateMatch = cleanedText.match(/Dated[:\-]?\s*(\d{2}-\d{2}-\d{4})/i);
  const endDateMatch = cleanedText.match(
    /Bid\s*End\s*Date\/Time\s*(\d{2}-\d{2}-\d{4}\s*\d{2}:\d{2}:\d{2})/i
  );
  const itemCategoryMatch = cleanedText.match(
    /Item\s*Category\s*[:\-]?\s*([\s\S]*?)(?=GeMARPTS|Document|required|$)/i
  );

  const documentReqMatch = cleanedText.match(
    /Document\s*required\s*from\s*seller\s*[:\-]?\s*([\s\S]*?)(?=In case|Consignee|$)/i
  );

  // ✅ Extract consignee blocks (Address only)
  const consigneeBlockRegex =
    /Consignees?[\s\S]*?(?=(?:Technical Specifications|Buyer Added|Scope of Supply|Disclaimer|$))/gi;
  const consigneeBlocks = cleanedText.match(consigneeBlockRegex) || [];

  const extractedConsignees: string[] = [];
  for (const block of consigneeBlocks) {
    // Each consignee entry generally has "Name + Address + Pin code"
    const addressRegex =
      /\d{6},\s*[\s\S]*?(?=(?:\d+\s+\d+|Delivery|Quantity|$))/g;
    const matches = block.match(addressRegex);
    if (matches) {
      for (const m of matches) {
        extractedConsignees.push(m.replace(/\s+/g, " ").trim());
      }
    }
  }

  console.log("📄 Total Consignee Addresses Extracted:", extractedConsignees.length);

  // Final extracted object
  const extracted = {
    bidNumber: bidNumberMatch ? bidNumberMatch[1].trim() : null,
    startDate: startDateMatch ? startDateMatch[1] : null,
    endDate: endDateMatch ? endDateMatch[1].trim() : null,
    itemCategory: itemCategoryMatch
      ? itemCategoryMatch[1].replace(/\s+/g, " ").trim()
      : null,
    documentsRequired: documentReqMatch
      ? documentReqMatch[1].replace(/\s+/g, " ").trim()
      : null,
    consignees: extractedConsignees.length > 0 ? extractedConsignees : null,
  };

  console.log("🗂️ Extracted Fields:", extracted);
  return extracted;
}

