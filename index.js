const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("chrome-aws-lambda");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";

app.get("/", async (req, res) => {
  try {
    // Check API key
    if (API_KEY && req.get("x-api-key") !== API_KEY) {
      console.log("Unauthorized request");
      return res.status(401).send("Unauthorized");
    }

    // Get URL from query
    const url = (req.query.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      console.log("Invalid or missing URL:", url);
      return res.status(400).send("Missing or invalid ?url=");
    }

    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      args: chromium.args.concat([
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ])
    });

    console.log("Opening new page...");
    const page = await browser.newPage();

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });

    console.log("Capturing MHTML...");
    const client = await page.target().createCDPSession();
    const { data } = await client.send("Page.captureSnapshot", { format: "mhtml" });

    await browser.close();
    console.log("Sending MHTML response...");

    res.setHeader("Content-Type", "multipart/related");
    res.setHeader("Content-Disposition", "attachment; filename=page.mhtml");
    res.send(Buffer.from(data));

  } catch (err) {
    console.error("Error generating MHTML:", err);
    res.status(500).send("Error generating MHTML");
  }
});

app.listen(PORT, () => console.log(`Puppeteer MHTML service listening on port ${PORT}`));
