import { chromium } from "playwright";
import { downloadPDF } from "./downloadPDF";

async function fetchGemTenderData() {
  const browser = await chromium.launch({ headless: true }); // headless mode
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🌐 Opening GeM Advance Search Page...");
  await page.goto("https://bidplus.gem.gov.in/advance-search", {
    waitUntil: "domcontentloaded",
  });

  // CSRF token from cookies
  const cookies = await context.cookies();
  const csrfCookie = cookies.find((c) => c.name.includes("csrf"));
  if (!csrfCookie) throw new Error("CSRF token not found!");
  const csrfToken = csrfCookie.value;
  console.log("✅ CSRF Token:", csrfToken);

  // Prepare payload
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
    return;
  }

  // Iterate tenders and download + extract PDFs
  for (const tender of tenders) {
    const tenderId = tender.id;
    const bidNumber = tender.b_bid_number[0];
    console.log(`\n📥 Processing Tender: ${bidNumber} (ID: ${tenderId})`);

    const text = await downloadPDF(tenderId);
    console.log(`📌 Extracted snippet for ${bidNumber}:`, text?.slice(0, 200));
  }

  await browser.close();
  console.log("\n🎉 All PDFs processed!");
}

fetchGemTenderData().catch((error) =>
  console.error("❌ Error scraping GeM tenders:", error)
);
