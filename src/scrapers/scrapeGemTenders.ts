import { chromium } from "playwright";

async function fetchGemTenderData() {
  const browser = await chromium.launch({ headless: false }); // Browser visible
  const context = await browser.newContext();
  const page = await context.newPage();

  // Step 1: Open advance-search page
  await page.goto("https://bidplus.gem.gov.in/advance-search", {
    waitUntil: "domcontentloaded",
  });

  // Step 2: Get CSRF token from cookies
  const cookies = await context.cookies();
  const csrfCookie = cookies.find((c) => c.name.includes("csrf"));
  if (!csrfCookie) throw new Error("CSRF token not found!");
  const csrfToken = csrfCookie.value;
  console.log("✅ CSRF Token:", csrfToken);

  // Step 3: Prepare payload for tender search
  const payloadObj = {
    searchType: "con",
    state_name_con: "JHARKHAND",
    city_name_con: "",
    bidEndFromCon: "",
    bidEndToCon: "",
    page: 1,
  };

  const payloadStr = JSON.stringify(payloadObj);

  // Step 4: POST request to search-bids API
  const tenderResp = await page.request.post(
    "https://bidplus.gem.gov.in/search-bids",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      form: {
        payload: payloadStr,       // payload as string
        csrf_bd_gem_nk: csrfToken, // CSRF token
      },
    }
  );

  console.log("📌 Tender API Status:", tenderResp.status());

  const text = await tenderResp.text();
  console.log("🔎 Raw Response (first 300 chars):", text.slice(0, 300));

  // Step 5: Parse response JSON
  let tenderData: any;
  try {
    tenderData = JSON.parse(text);
  } catch {
    throw new Error("❌ Server returned HTML instead of JSON. Check CSRF/cookies.");
  }

  const tenders = tenderData.response?.response?.docs || [];
  console.log("✅ Total Tenders Fetched:", tenders.length);

  if (tenders.length > 0) {
    console.log("📌 Sample Tender:", JSON.stringify(tenders[0], null, 2));
  }

  await browser.close();
}

fetchGemTenderData().catch((error) => {
  console.error("❌ Error scraping GeM tenders:", error);
});
