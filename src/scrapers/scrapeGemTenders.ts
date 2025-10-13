import { chromium, Page } from "playwright";
import { downloadPDF } from "./downloadPDF";
import connectDB from "../config/db";
import { saveTender } from "../services/tenderService";

// Helper: Is ISO date string today?
function isTodayISO(isoDate?: string): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

// Helper: parseTenderDate for dd-mm-yyyy and dd-mm-yyyy hh:mm:ss
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

  let allTenders: any[] = [];
  let currentPage = 0;
  const pageSize = 10;
  let fetched = 0;
  let totalToFetch = 0;

  while (true) {
    const payloadObj = {
      searchType: "con",
      state_name_con: "JHARKHAND",
      city_name_con: "Ranchi",
      bidEndFromCon: "",
      bidEndToCon: "",
      page: currentPage + 1, // API is 1-based index for "page"
    };
    const payloadStr = JSON.stringify(payloadObj);

    console.log(`🔍 Fetching page ${currentPage + 1} from API...`);
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

    if (currentPage === 0) {
      totalToFetch = tenderData.response?.response?.numFound || 0;
      console.log(`📦 Total tenders to fetch: ${totalToFetch}`);
    }

    const docs = tenderData.response?.response?.docs || [];
    fetched += docs.length;
    console.log(
      `✔️ Fetched ${docs.length} this page | Total so far: ${fetched}`
    );
    allTenders.push(...docs);

    if (fetched >= totalToFetch || docs.length === 0) break;
    currentPage += 1;
  }

  console.log(`✅ Total tenders fetched (all pages): ${allTenders.length}`);
  if (!allTenders.length) {
    console.log("⚠️ No tenders found after pagination!");
    await browser.close();
    return;
  }

  // Product tenders + Only today's using final_start_date_sort[0]
  const onlyTodayProductTenders = allTenders.filter((t: any) => {
    if (!Array.isArray(t.b_cat_id)) return false;
    const catId = t.b_cat_id[0];
    if (typeof catId !== "string") return false;
    if (catId.toLowerCase().startsWith("services_")) return false;
    // Today's check with ISO start field
    return isTodayISO(t.final_start_date_sort?.[0]);
  });

  console.log(
    `✅ Today's Product Tenders Count: ${onlyTodayProductTenders.length}`
  );
  console.log("Today's Product Tenders (Raw API Data):");
  onlyTodayProductTenders.forEach((tender, idx) => {
    console.log(`[${idx + 1}]`, JSON.stringify(tender, null, 2));
  });

  for (const tender of onlyTodayProductTenders) {
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
