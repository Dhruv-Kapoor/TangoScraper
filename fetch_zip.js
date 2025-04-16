// 30 12 * * * /home/dhruv/.nvm/versions/node/v18.16.0/bin/node /home/dhruv/Desktop/crons/fetch_queens.js
console.log("Fetch zip running");

const { ScrapeUtil } = require("./utils");

async function scrapeZip(pageLink) {
  console.log("Scraping");
  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(true);
  await page.goto(pageLink, {
    waitUntil: "networkidle0",
  });
  await page.click("[id=launch-footer-start-button]", {
    waitUntil: "networkidle0",
  });

  const data = await page.evaluate(() => {
    let elements = Array.from(
      document.querySelector("[class^=trail-grid]").children
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
        value: null,
        topWall: false,
        leftWall: false,
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

        dom[0].children.forEach((element) => {
          if (element.attribs?.class?.includes("trail-cell-content")) {
            grid[grid_i][grid_j].value = parseInt(
              element.children[0].data.replace(/\D+/g, "")
            );
          }
          if (element.attribs?.class?.includes("trail-cell-wall--down")) {
            grid[grid_i + 1][grid_j].topWall = true;
          }
          if (element.attribs?.class?.includes("trail-cell-wall--right")) {
            grid[grid_i][grid_j + 1].leftWall = true;
          }
          if (element.attribs?.class?.includes("trail-cell-wall--up")) {
            grid[grid_i ][grid_j].topWall = true;
          }
          if (element.attribs?.class?.includes("trail-cell-wall--left")) {
            grid[grid_i][grid_j].leftWall = true;
          }
        });
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
    CHAT_WEBHOOK: process.env.ZIP_CHAT_WEBHOOK,
    GRID_TYPE: 3,
    LAST_FETCHED_FILE: "latest_zip.txt",
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    PAGE_LINK: 'https://www.linkedin.com/games/view/zip/desktop'
  },
  scrapeZip,
  makeGrid,
  process.argv[2] == "test"
);

util.run();
