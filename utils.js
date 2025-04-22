const firebaseAdmin = require("firebase-admin");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const https = require("https");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ScrapeUtil {
  constructor(
    config,
    scrapeFunction,
    makeGridFunction,
    label,
    testMode,
    disableNotifications
  ) {
    this.MAX_RETRIES = 12;
    this.RETRY_DELAY = 5 * 60 * 1000;

    this.CHAT_WEBHOOK = config.CHAT_WEBHOOK;
    this.GRID_TYPE = config.GRID_TYPE;
    this.LAST_FETCHED_FILE = config.LAST_FETCHED_FILE;
    this.PAGE_LINK = config.PAGE_LINK;
    this.IS_TEST_MODE = testMode;

    this.USE_COOKIES = process.env.USE_COOKIES == 'true';
    this.COOKIES = JSON.parse(process.env.COOKIES);

    this.disableNotifications = disableNotifications;
    this.scrape = scrapeFunction;
    this.makeGrid = makeGridFunction;
    this.label = label;
    if (testMode) {
      this.FIRESTORE_COLLECTION = "test";
    } else {
      this.FIRESTORE_COLLECTION = "grids";
    }

    this.serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(this.serviceAccount),
    });
  }

  async uploadToFirestore(grid, number) {
    console.log("Uploading to firestore");

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
    return new Promise((resolve, reject) => {
      if (this.IS_TEST_MODE) {
        message = `[TEST] ${message}`;
      }
      console.log("Notifying", message);

      if (this.disableNotifications) {
        resolve("Notifications disabled");
        return;
      }

      var options = {
        host: "chat.googleapis.com",
        path: this.CHAT_WEBHOOK,
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            console.log(
              `Request failed with status code ${res.statusCode}: ${data}`
            );
            resolve(null);
          }
        });
      });

      req.on("error", (error) => {
        console.log(`Request failed with error: ${error}`);
        resolve(null);
      });

      req.write(
        JSON.stringify({
          text: message,
        })
      );
      req.end();
    });
  }

  async updateLastFetched(newId) {
    const fs = require("node:fs");
    fs.writeFileSync(this.LAST_FETCHED_FILE, `${newId}`, { encoding: "utf-8" });
  }

  async fetchAvailableId() {
    const puppeteer = require("puppeteer");

    let data = null;
    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      if (this.USE_COOKIES) {
        await browser.setCookie(...this.COOKIES);
      }
      await page.setJavaScriptEnabled(true);
      await page.goto(this.PAGE_LINK, {
        waitUntil: "networkidle2",
      });

      data = await page.evaluate(() => {
        const res = document
          .querySelector("[class=launch-footer__score-text]")
          .innerHTML.split(".")[1];
        return parseInt(res);
      });
    } catch (e) {
      await browser.close();
      throw e;
    }
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
      const lastFetchedId = await getLastFetchedId(this.LAST_FETCHED_FILE);
      const newId = await this.checkForUpdates(lastFetchedId);
      const data = await this.scrape(this.PAGE_LINK, this.USE_COOKIES ? this.COOKIES : null);
      const grid = await this.makeGrid(data);
      await this.uploadToFirestore(grid, newId);
      await this.notify("Scraped and uploaded successfully");
      if (!this.IS_TEST_MODE) {
        await sendPushNotification(
          "new_levels",
          `Today's ${this.label} #${newId} is now available`,
          "Play Now!"
        );
      }
    } catch (e) {
      console.log(e);
      await this.notify(`Some error occured. Details:\n${e}`);
    }

    console.log("Fetch completed");
  }
}

async function sendPushNotification(topic, title, description) {
  const message = {
    topic: topic,
    notification: {
      title: title,
      body: description,
    },
  };

  try {
    await firebaseAdmin.messaging().send(message);
    console.log("Notification sent to all users");
  } catch (error) {
    console.error("Error:", error);
  }
}

async function getLastFetchedId(file) {
  const fs = require("node:fs");
  const res = fs.readFileSync(file, { encoding: "utf-8" });
  return parseInt(res);
}

module.exports = { ScrapeUtil, delay, sendPushNotification, getLastFetchedId };
