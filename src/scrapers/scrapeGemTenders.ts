import { chromium, APIResponse, Page } from "playwright";
import { downloadPDF } from "./downloadPDF";
import connectDB from "../config/db";
import { saveTender } from "../services/tenderService";
import fs from "fs";
import path from "path";
import TenderModel from "../models/tender.model";

const TENDER_LOG_DIR = "./tenderLogs"; // Folder for daily logs

function getDateString(isoString?: string): string | undefined {
  if (!isoString) return undefined;
  return new Date(isoString).toISOString().substring(0, 10);
}

function parseTenderDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(
    /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/
  );
  if (!match) return undefined;
  const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = match;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
}

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

async function isTenderAlreadySaved(
  bidNumber: string,
  tenderId: string,
  dir = "./downloads/"
): Promise<boolean> {
  const found = await TenderModel.findOne({ tenderNo: bidNumber });
  const pdfExists = fs.existsSync(path.join(dir, `${tenderId}.pdf`));
  return !!found || pdfExists;
}

function logTenderIds(tenderIds: string[], dateStr: string) {
  if (!fs.existsSync(TENDER_LOG_DIR)) fs.mkdirSync(TENDER_LOG_DIR);
  fs.writeFileSync(
    path.join(TENDER_LOG_DIR, `${dateStr}.json`),
    JSON.stringify(tenderIds, null, 2)
  );
  console.log(`📝 Logged ${tenderIds.length} tender IDs to ${TENDER_LOG_DIR}/${dateStr}.json`);
}

// Core fetch to collect all tenders
async function fetchGemTenderData_Internal(targetDate: string): Promise<Record<string, any>[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  await safeGoto(page, "https://bidplus.gem.gov.in/advance-search");

  const cookies = await context.cookies();
  const csrfCookie = cookies.find((c) => c.name.includes("csrf"));
  if (!csrfCookie) throw new Error("CSRF token not found!");
  const csrfToken = csrfCookie.value;

  let allTenders: Record<string, any>[] = [];
  const fetchedTenderIDs = new Set<string>();
  let currentPage = 0;
  let totalToFetch = 0;

  while (true) {
    const payloadObj = {
      searchType: "con",
      state_name_con: "JHARKHAND",
      city_name_con: "Ranchi",
      page: currentPage + 1,
    };
    const payloadStr = JSON.stringify(payloadObj);

    let tenderResp: APIResponse | undefined;
    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        tenderResp = await page.request.post(
          "https://bidplus.gem.gov.in/search-bids",
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
            },
            form: { payload: payloadStr, csrf_bd_gem_nk: csrfToken },
          }
        );
        break;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        console.warn(`⚠️ API fetch failed (attempt ${attempt + 1}), retrying after delay...`);
        await new Promise(res => setTimeout(res, 1200));
      }
    }
    if (!tenderResp) throw new Error("Failed to fetch tender data after retries.");

    const text = await tenderResp.text();
    let tenderData: Record<string, any>;
    try {
      tenderData = JSON.parse(text);
    } catch {
      await browser.close();
      throw new Error("❌ Server returned HTML instead of JSON. Check CSRF/cookies.");
    }

    if (currentPage === 0) {
      totalToFetch = tenderData.response?.response?.numFound || 0;
      console.log(`📦 Total tenders to fetch: ${totalToFetch}`);
    }

    const docs: Record<string, any>[] = tenderData.response?.response?.docs || [];

    // Log all tenders (for full debug visibility)
    console.log(`📋 Page ${currentPage + 1}: received ${docs.length} tenders`);
    docs.forEach((d) =>
      console.log(`   • ${d.b_bid_number?.[0] || "Unknown"} (${d.id}) — Date: ${getDateString(d.final_start_date_sort?.[0])}`)
    );

    docs.forEach((doc: Record<string, any>) => {
      const tenderDateStr = getDateString(doc.final_start_date_sort?.[0]);
      if (!fetchedTenderIDs.has(doc.id) && tenderDateStr === targetDate) {
        if (
          Array.isArray(doc.b_cat_id) &&
          typeof doc.b_cat_id[0] === "string" &&
          !doc.b_cat_id[0].toLowerCase().startsWith("services_")
        ) {
          allTenders.push(doc);
          fetchedTenderIDs.add(doc.id);
        }
      }
    });

    await new Promise(res => setTimeout(res, 400));
    currentPage++;
    if (fetchedTenderIDs.size >= totalToFetch || docs.length === 0) break;
  }

  await browser.close();
  console.log(`🎯 Filtered tenders matching ${targetDate}: ${allTenders.length}`);
  return allTenders;
}

// Stabilization and deduplication logic (same)
async function stabilizedTenderFetch(
  targetDate: string,
  maxAttempts = 15,
  confirmStableRuns = 3,
  fetchDelayMs = 4000
): Promise<Record<string, any>[]> {
  let globalTenderIDs = new Set<string>();
  let globalTenderMap = new Map<string, any>();
  let stableStreak = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🔎 Tender fetch attempt ${attempt}`);
    const tenderList = await fetchGemTenderData_Internal(targetDate);
    let newFound = false;
    for (const tender of tenderList) {
      if (!globalTenderIDs.has(tender.id)) {
        globalTenderIDs.add(tender.id);
        globalTenderMap.set(tender.id, tender);
        newFound = true;
      }
    }
    if (newFound) stableStreak = 0;
    else {
      stableStreak++;
      console.log(`✅ Stable streak increased: ${stableStreak}/${confirmStableRuns}`);
      if (stableStreak >= confirmStableRuns) break;
    }
    await new Promise(res => setTimeout(res, fetchDelayMs));
  }
  console.log(`🏁 Final stabilized set: ${globalTenderIDs.size} tenders`);
  return Array.from(globalTenderMap.values());
}

// Main entry
async function fetchGemTenderData(targetDate?: string) {
  await connectDB();
  const dateToFetch = targetDate || new Date().toISOString().substring(0, 10);
  console.log(`📅 Fetching tenders for date: ${dateToFetch}`);

  const finalTenders = await stabilizedTenderFetch(dateToFetch);

  const tenderIds = finalTenders.map(t => t.id);
  logTenderIds(tenderIds, dateToFetch);

  for (const tender of finalTenders) {
    const tenderId = tender.id;
    const bidNumber = tender.b_bid_number[0];
    if (await isTenderAlreadySaved(bidNumber, tenderId)) continue;

    console.log(`📥 Processing Product Tender: ${bidNumber} (${tenderId})`);
    const result = await downloadPDF(tenderId, bidNumber);
    if (result) {
      const { extractedText, extractedFields } = result;
      await saveTender({
        tenderNo: extractedFields.bidNumber ?? undefined,
        category: extractedFields.itemCategory ?? undefined,
        startDate: parseTenderDate(extractedFields.startDate ?? undefined),
        endDate: parseTenderDate(extractedFields.endDate ?? undefined),
        documentsRequired: extractedFields.documentsRequired ? [extractedFields.documentsRequired] : [],
        documentDownloadLinks: [extractedFields.pdfdownload],
        consignees: extractedFields.consignees || [],
      });
      console.log(`✅ Tender ${bidNumber} saved to database`);
    }
  }

  console.log("\n🎉 All PDFs processed!");
}

fetchGemTenderData().catch(error =>
  console.error("❌ Error scraping GeM tenders:", error)
);

export { fetchGemTenderData };
