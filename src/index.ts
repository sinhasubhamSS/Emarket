import dotenv from "dotenv";
dotenv.config(); // Load .env variables at the very top

import connectDB from "./config/db";
import app from "./app";
import cron from "node-cron";
import { fetchGemTenderData } from "./scrapers/scrapeGemTenders";

async function startServerAndScheduler() {
  // Debug: log the MongoDB URL for verification
  console.log("MongoDB URL:", process.env.MONGODB_URL);

  // Connect once to MongoDB
  await connectDB();

  const PORT = process.env.PORT || 5000;

  // Start the Express server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  // Schedule a one-time scraper run at 8:22 PM today, if possible
  const now = new Date();
  const runTime = new Date();
  runTime.setHours(20, 45, 0, 0); // 8:22 PM today

  let delay = runTime.getTime() - now.getTime();
  if (delay > 0) {
    setTimeout(async () => {
      console.log("🕗 Running one-time scraper at 8:45 PM...");
      try {
        await fetchGemTenderData();
        console.log("✅ One-time scraper run complete");
      } catch (error) {
        console.error("❌ Error in one-time scraper run:", error);
      }
    }, delay);
  } else {
    console.log("8:45 PM already passed today, skipping one-time run");
  }

  // Schedule daily scraper run at 2 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("🕑 Running daily scheduled tender scraper at 2 AM...");
    try {
      await fetchGemTenderData();
      console.log("✅ Daily scraper run complete");
    } catch (error) {
      console.error("❌ Error in daily scraper run:", error);
    }
  });
}

startServerAndScheduler().catch((error) => {
  console.error("❌ Failed to start server or scheduler:", error);
  process.exit(1);
});
