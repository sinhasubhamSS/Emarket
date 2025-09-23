import { chromium } from "playwright";

async function fetchGemTenderData() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Step 1: Go to advance search page
  await page.goto("https://bidplus.gem.gov.in/advance-search");

  // Step 2: Wait for state-list-adv API response to get states
  const stateListResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("/state-list-adv") && response.status() === 200
  );
  const statesData = await stateListResponse.json();

  console.log("States List:", statesData);

  // Step 3: Find Jharkhand entry in states list
  const selectedState =
    statesData.find(
      (s: any) =>
        s.state_name?.toUpperCase() === "JHARKHAND" ||
        s.state_name_con?.toUpperCase() === "JHARKHAND"
    ) || {};

  // Step 4: Select "Search by Consignee" option/tab
  // Replace '#search-by-consignee' with correct selector if needed
  await page.click("#search-by-consignee");

  // Step 5: Select Jharkhand in state dropdown
  // Adjust selector if needed based on element inspection
  await page.selectOption(
    'select[name="state_name_con"]',
    selectedState.state_name_con || "JHARKHAND"
  );

  // Step 6: Leave district blank (optional)
  await page.selectOption('select[name="city_name_con"]', "");

  // Step 7: Wait for tender data response triggered by search
  const tenderResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/search-bids") && response.status() === 200
  );

  // Step 8: Click the search button
  // Adjust 'button#searchButton' selector if necessary based on actual page
  await Promise.all([tenderResponsePromise, page.click("button#searchButton")]);

  // Step 9: Extract tender data JSON
  const tenderResponse = await tenderResponsePromise;
  const tenderData = await tenderResponse.json();

  console.log("Tender Data:", JSON.stringify(tenderData, null, 2));

  // TODO: Add logic here to save tenderData into MongoDB using your tender.ts model

  await browser.close();
}

fetchGemTenderData().catch((error) => {
  console.error("Error in scraping GeM tenders:", error);
});
