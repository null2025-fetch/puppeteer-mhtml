const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";

app.get("/", async (req, res) => {
  try {
    if (API_KEY && req.get("x-api-key") !== API_KEY) {
      return res.status(401).send("Unauthorized");
    }

    const url = (req.query.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).send("Missing or invalid ?url=");
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });

    const client = await page.target().createCDPSession();
    const { data } = await client.send("Page.captureSnapshot", { format: "mhtml" });

    await browser.close();

    res.setHeader("Content-Type", "multipart/related");
    res.setHeader("Content-Disposition", "attachment; filename=page.mhtml");
    res.send(Buffer.from(data));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating MHTML");
  }
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
