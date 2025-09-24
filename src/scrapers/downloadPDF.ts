import fs from "fs";
import path from "path";
import axios from "axios";

export async function downloadPDF(tenderId: number) {
  try {
    const pdfUrl = `https://bidplus.gem.gov.in/showbidDocument/${tenderId}`;
    const downloadDir = path.resolve(__dirname, "../../downloads");

    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    const filePath = path.join(downloadDir, `${tenderId}.pdf`);
    console.log(`📥 Downloading PDF for Tender ID: ${tenderId} from URL: ${pdfUrl}`);

    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);

    console.log(`✅ PDF Saved: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error downloading PDF for Tender ID: ${tenderId}`, error);
  }
}
