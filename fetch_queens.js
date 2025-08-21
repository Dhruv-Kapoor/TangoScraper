// 30 12 * * * /home/dhruv/.nvm/versions/node/v18.16.0/bin/node /home/dhruv/Desktop/crons/fetch_queens.js
console.log("Fetch queens running");

const { ScrapeUtil } = require("./utils");

async function scrapeQueens(pageLink, cookies) {
  console.log("Scraping");
  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch();
  if (cookies) {
    await browser.setCookie(...cookies);
  }
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(true);
  await page.goto(pageLink, {
    waitUntil: "networkidle2",
  });
  await page.click("[id=launch-footer-start-button]", {
    waitUntil: "networkidle2",
  });

  const data = await page.evaluate(() => {
    let elements = Array.from(
      document.querySelectorAll("[class^=queens-cell]")
    );
    let cells = elements.map((element) => {
      return element.outerHTML;
    });
    return cells;
  });

  await browser.close();

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
        color: -1,
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
        grid[grid_i][grid_j].color = parseInt(
          dom[0].attribs.class.split("cell-color-")[1].trim()
        );
      }
    });
    var parser = new htmlparser.Parser(handler);
    parser.parseComplete(ele);
  }

  console.log("Transforming grid complete");
  return grid;
}

const util = new ScrapeUtil(
  {
    CHAT_WEBHOOK: process.env.QUEENS_CHAT_WEBHOOK,
    GRID_TYPE: 2,
    LAST_FETCHED_FILE: "latest_queens.txt",
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    PAGE_LINK: 'https://www.linkedin.com/games/view/queens/desktop'
  },
  scrapeQueens,
  makeGrid,
  "Queens",
  process.argv.includes('test'),
);

util.run();
