// 30 12 * * * /home/dhruv/.nvm/versions/node/v18.16.0/bin/node /home/dhruv/Desktop/crons/fetch_queens.js
console.log("Fetch queens running");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const LAST_FETCHED_FILE = 'latest_queens.txt'
const CHAT_WEBHOOK = process.env.QUEENS_CHAT_WEBHOOK;
const IS_TEST_MODE = process.argv[2] == "test";

var FIRESTORE_COLLECTION;
if (IS_TEST_MODE) {
  FIRESTORE_COLLECTION = 'test';
} else {
  FIRESTORE_COLLECTION = 'grids';
}

const MAX_RETRIES = 12;
const RETRY_DELAY = 5*60*1000;
const PAGE_LINK = "https://www.linkedin.com/games/view/queens/desktop";

async function scrapeQueens() {
  console.log("Scraping");
  const puppeteer = require("puppeteer");
  // const fs = require("node:fs");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(true);
  await page.goto(PAGE_LINK, {
    waitUntil: "networkidle0",
  });
  await page.click('[id=launch-footer-start-button]', {
    waitUntil: "networkidle0",
  });

  const data = await page.evaluate(() => {
    let elements = Array.from(document.querySelectorAll("[class^=queens-cell]"));
    let cells = elements.map((element) => {
      return element.outerHTML;
    });
    return cells;
  });

  await browser.close();

  // fs.writeFile('test.json', JSON.stringify(data), (err) => {
  //   if (err) {
  //     console.error(err);
  //   } else {
  //     console.log("File written");
  //   }
  // });

  console.log("Scraping complete");
  return data;
}

async function makeGrid(data) {
  console.log("Transforming into grid");
  const htmlparser = require("htmlparser");
  const size = Math.sqrt(data.length);

  const grid = [];
  for (let i = 0; i < size; ++i) {
    const ar = [];
    for (let j = 0; j < size; ++j) {
      ar.push({
        value: 1,
        color: -1
      });
    }
    grid.push(ar);
  }

  for (let i = 0; i <= data.length; i++) {
    const ele = data[i];
    var handler = new htmlparser.DefaultHandler(function (error, dom) {
      if (!error) {
        if (dom[0].name != "div") return;
        const index = parseInt(dom[0].attribs["data-cell-idx"]);
        const grid_i = Math.floor(index / size);
        const grid_j = index % size;
        grid[grid_i][grid_j].color = parseInt(dom[0].attribs.class.split('cell-color-')[1][0])
      }
    });
    var parser = new htmlparser.Parser(handler);
    parser.parseComplete(ele);
  }

  console.log("Transforming grid complete");
  return grid;
}

async function uploadToFirestore(grid) {
  console.log("Uploading to firestore");

  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore, FieldValue } = require("firebase-admin/firestore");

  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();

  var docRef = db.collection(FIRESTORE_COLLECTION);
  docRef = docRef.doc();

  await docRef.set({
    date: FieldValue.serverTimestamp(),
    grid: JSON.stringify(grid),
    number: await getLastFetchedId(),
    type: 2
  });

  console.log("Uploading to firestore complete");
}

async function notify(message) {
  console.log("Notifying", message);

  if (IS_TEST_MODE) {
    message = `[TEST] ${message}`
  }

  var https = require("https");
  var options = {
    host: "chat.googleapis.com",
    path: CHAT_WEBHOOK,
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

async function getLastFetchedId() {
  const fs = require("node:fs");
  const res = fs.readFileSync(LAST_FETCHED_FILE, {encoding: 'utf-8'});
  return parseInt(res)
}

async function updateLastFetched(newId) {
  const fs = require("node:fs");
  fs.writeFileSync(LAST_FETCHED_FILE, `${newId}`, {encoding: 'utf-8'});
}

async function fetchAvailableId() {
  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(true);
  await page.goto(PAGE_LINK, {
    waitUntil: "networkidle0",
  });

  const data = await page.evaluate(() => {
    const res = document.querySelector("[class=launch-footer__score-text]").innerHTML.split('.')[1];
    return parseInt(res);
  });

  await browser.close();

  return data;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function checkForUpdates() {
  const lasFetched = await getLastFetchedId();
  var currentTry = 0;
  while (currentTry < MAX_RETRIES) {
    await notify('Checking for new queens...');
    const availableId = await fetchAvailableId();
    if (availableId > lasFetched) {
      await notify(`New queens found with id: ${availableId}`);
      await updateLastFetched(availableId);
      return;
    } else {
      await notify(`No updates found, will retry after ${RETRY_DELAY/60000} minutes`);
      currentTry = currentTry + 1;
      if (currentTry < MAX_RETRIES) {
        await delay(RETRY_DELAY);
      }
    }
  }
  throw `New queens not found after ${MAX_RETRIES} tries, exiting`;
}

async function run() {
  try {
    await checkForUpdates();
    const data = await scrapeQueens();
    const grid = await makeGrid(data);
    await uploadToFirestore(grid)
    await notify("Queens scraped and uploaded successfully");
  } catch (e) {
    console.log(e);
    await notify(`Some error occured. Details:\n${e}`);
  }

  console.log("Fetch queens completed");
}

run();
