import { chromium, Page } from "playwright";
import { downloadPDF } from "./downloadPDF";
import connectDB from "../config/db";
import { saveTender } from "../services/tenderService";

// Custom date parser for dd-mm-yyyy and dd-mm-yyyy hh:mm:ss formats
function parseTenderDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(
    /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/
  );
  if (!match) return undefined;
  const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = match;
  const isoString = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
  const dateObj = new Date(isoString);
  return isNaN(dateObj.getTime()) ? undefined : dateObj;
}

// Safe page.goto with retries
async function safeGoto(page: Page, url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    } catch (err) {
      console.warn(`⚠️ Navigation failed (attempt ${i + 1}) → Retrying...`);
      if (i === retries - 1) throw err;
    }
  }
}

async function fetchGemTenderData() {
  await connectDB();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  console.log("🌐 Opening GeM Advance Search Page...");
  await safeGoto(page, "https://bidplus.gem.gov.in/advance-search");

  const cookies = await context.cookies();
  const csrfCookie = cookies.find((c) => c.name.includes("csrf"));
  if (!csrfCookie) throw new Error("CSRF token not found!");
  const csrfToken = csrfCookie.value;
  console.log("✅ CSRF Token:", csrfToken);

  const payloadObj = {
    searchType: "con",
    state_name_con: "JHARKHAND",
    city_name_con: "",
    bidEndFromCon: "",
    bidEndToCon: "",
    page: 1,
  };
  const payloadStr = JSON.stringify(payloadObj);

  console.log("🔍 Fetching tenders from API...");
  const tenderResp = await page.request.post(
    "https://bidplus.gem.gov.in/search-bids",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      form: { payload: payloadStr, csrf_bd_gem_nk: csrfToken },
    }
  );

  console.log("📌 Tender API Status:", tenderResp.status());
  const text = await tenderResp.text();

  let tenderData: any;
  try {
    tenderData = JSON.parse(text);
  } catch {
    throw new Error(
      "❌ Server returned HTML instead of JSON. Check CSRF/cookies."
    );
  }

  const tenders = tenderData.response?.response?.docs || [];
  console.log(`✅ Total Tenders Fetched: ${tenders.length}`);

  if (tenders.length === 0) {
    console.log("⚠️ No tenders found!");
    await browser.close();
    return;
  }

  // Filter only product tenders (skip services)
  const onlyProductTenders = tenders.filter((t: any) => {
    if (!Array.isArray(t.b_cat_id)) {
      console.warn("Skipping tender due to missing b_cat_id array:", t.id);
      return false;
    }
    const catId = t.b_cat_id[0];
    if (typeof catId !== "string") {
      console.warn("Skipping tender due to non-string b_cat_id:", t.id, catId);
      return false;
    }
    const isService = catId.toLowerCase().startsWith("services_");
    console.log(
      `Tender ${t.id} category check: ${catId} -> isService=${isService}`
    );
    return !isService;
  });

  console.log(`✅ Product Tenders Count: ${onlyProductTenders.length}`);

  for (const tender of onlyProductTenders) {
    const tenderId = tender.id;
    const bidNumber = tender.b_bid_number[0];

    console.log(
      `\n📥 Processing Product Tender: ${bidNumber} (ID: ${tenderId})`
    );

    const result = await downloadPDF(tenderId, bidNumber);
    if (result) {
      const { extractedText, extractedFields } = result;

      console.log(
        `📌 Extracted snippet for ${bidNumber}:`,
        extractedText.slice(0, 200)
      );
      console.log(`🗂️ Extracted Fields for ${bidNumber}:`, extractedFields);
      console.log("Debug Dates:", {
        startDateRaw: extractedFields.startDate,
        endDateRaw: extractedFields.endDate,
      });

      await saveTender({
        tenderNo: extractedFields.bidNumber ?? undefined,
        category: extractedFields.itemCategory ?? undefined,
        startDate: parseTenderDate(extractedFields.startDate ?? undefined),
        endDate: parseTenderDate(extractedFields.endDate ?? undefined),
        documentsRequired: extractedFields.documentsRequired
          ? [extractedFields.documentsRequired]
          : [],
        documentDownloadLinks: [extractedFields.pdfdownload],
        consignees: extractedFields.consignees || [],
      });

      console.log(`✅ Tender ${bidNumber} saved to database`);
    }
  }

  await browser.close();
  console.log("\n🎉 All PDFs processed!");
}

fetchGemTenderData().catch((error) =>
  console.error("❌ Error scraping GeM tenders:", error)
);
export { fetchGemTenderData };
