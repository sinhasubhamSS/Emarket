import fs from "fs";
import path from "path";
import axios from "axios";
import { extractPDFText, extractRelevantFields } from "./extractPDF";

export async function downloadPDF(tenderId: number, bidNumber: string) {
  try {
    const pdfUrl = `https://bidplus.gem.gov.in/showbidDocument/${tenderId}`;
    const downloadDir = path.resolve(__dirname, "../../downloads");

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const filePath = path.join(downloadDir, `${tenderId}.pdf`);
    console.log(
      `📥 Downloading PDF for Tender ID: ${tenderId} from URL: ${pdfUrl}`
    );

    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);

    console.log(`✅ PDF Saved: ${filePath}`);

    // Extract text after saving
    const extractedText = await extractPDFText(filePath);

    // Extract fields (pass tenderId & bidNumber)
    const extractedFields = extractRelevantFields(
      extractedText,
      tenderId,
      bidNumber
    );

    console.log(
      `📑 Tender ID ${tenderId} Extracted Text Length: ${extractedText.length}`
    );

    return { extractedText, extractedFields };
  } catch (error) {
    console.error(`❌ Error downloading PDF for Tender ID: ${tenderId}`, error);
    return null;
  }
}
