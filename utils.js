const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const https = require("https");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ScrapeUtil {
  constructor(config, scrapeFunction, makeGridFunction, testMode) {
    this.MAX_RETRIES = 12;
    this.RETRY_DELAY = 5 * 60 * 1000;

    this.CHAT_WEBHOOK = config.CHAT_WEBHOOK;
    this.GRID_TYPE = config.GRID_TYPE;
    this.LAST_FETCHED_FILE = config.LAST_FETCHED_FILE;
    this.PAGE_LINK = config.PAGE_LINK;
    this.IS_TEST_MODE = testMode;

    this.serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT);
    this.scrape = scrapeFunction;
    this.makeGrid = makeGridFunction;
    if (testMode) {
      this.FIRESTORE_COLLECTION = "test";
      // } else {
      //   this.FIRESTORE_COLLECTION = 'grids';
    }
  }

  async uploadToFirestore(grid, number) {
    console.log("Uploading to firestore");

    initializeApp({
      credential: cert(this.serviceAccount),
    });

    const db = getFirestore();

    var docRef = db.collection(this.FIRESTORE_COLLECTION);
    docRef = docRef.doc();

    await docRef.set({
      date: FieldValue.serverTimestamp(),
      grid: JSON.stringify(grid),
      number: number,
      type: this.GRID_TYPE,
    });

    console.log("Uploading to firestore complete");
  }

  async notify(message) {
    console.log("Notifying", message);

    if (this.IS_TEST_MODE) {
      message = `[TEST] ${message}`;
    }

    var options = {
      host: "chat.googleapis.com",
      path: this.CHAT_WEBHOOK,
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
    };

    const req = https.request(options, function (res) {});
    req.write(
      JSON.stringify({
        text: message,
      })
    );
    req.end();
  }

  async getLastFetchedId() {
    const fs = require("node:fs");
    const res = fs.readFileSync(this.LAST_FETCHED_FILE, { encoding: "utf-8" });
    return parseInt(res);
  }

  async updateLastFetched(newId) {
    const fs = require("node:fs");
    fs.writeFileSync(this.LAST_FETCHED_FILE, `${newId}`, { encoding: "utf-8" });
  }

  async fetchAvailableId() {
    const puppeteer = require("puppeteer");

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(true);
    await page.goto(this.PAGE_LINK, {
      waitUntil: "networkidle0",
    });

    const data = await page.evaluate(() => {
      const res = document
        .querySelector("[class=launch-footer__score-text]")
        .innerHTML.split(".")[1];
      return parseInt(res);
    });

    await browser.close();

    return data;
  }

  async checkForUpdates(lastFetched) {
    // const lasFetched = await this.getLastFetchedId();
    var currentTry = 0;
    while (currentTry < this.MAX_RETRIES) {
      await this.notify("Checking for updates...");
      const availableId = await this.fetchAvailableId();
      if (availableId > lastFetched) {
        await this.notify(`New level found with id: ${availableId}`);
        await this.updateLastFetched(availableId);
        return availableId;
      } else {
        await this.notify(
          `No updates found, will retry after ${
            this.RETRY_DELAY / 60000
          } minutes`
        );
        currentTry = currentTry + 1;
        if (currentTry < this.MAX_RETRIES) {
          await delay(this.RETRY_DELAY);
        }
      }
    }
    throw `Update not found after ${this.MAX_RETRIES} tries, exiting`;
  }

  async run() {
    try {
      const lastFetchedId = await this.getLastFetchedId();
      const newId = await this.checkForUpdates(lastFetchedId);
      const data = await this.scrape(this.PAGE_LINK);
      const grid = await this.makeGrid(data);
      await this.uploadToFirestore(grid, newId);
      await this.notify("Scraped and uploaded successfully");
    } catch (e) {
      console.log(e);
      await this.notify(`Some error occured. Details:\n${e}`);
    }

    console.log("Fetch completed");
  }
}

module.exports = {ScrapeUtil};
