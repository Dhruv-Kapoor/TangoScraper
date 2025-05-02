// 30 12 * * * /home/dhruv/.nvm/versions/node/v18.16.0/bin/node /home/dhruv/Desktop/crons/fetch_tango.js
console.log("Fetch tango running");

const { ScrapeUtil } = require("./utils");

async function scrapeTango(pageLink, cookies) {
  console.log("Scraping");
  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch();
  if (cookies) {
    await browser.setCookie(...cookies);
  }
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("play:tutorial:lotka", true);
  });
  await page.setJavaScriptEnabled(true);
  await page.goto(pageLink, {
    waitUntil: "networkidle2",
  });
  await page.click("[id=launch-footer-start-button]", {
    waitUntil: "networkidle2",
  });

  const data = await page.evaluate(() => {
    let elements = Array.from(document.querySelectorAll("[id^=lotka-cell]"));
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

  const grid = [];
  for (let i = 0; i < 6; ++i) {
    const ar = [];
    for (let j = 0; j < 6; ++j) {
      ar.push({
        value: 1,
        disabled: false,
        leftSymbol: j == 0 ? 1 : 2,
        topSymbol: i == 0 ? 1 : 2,
      });
    }
    grid.push(ar);
  }

  for (let i = 0; i <= data.length; i++) {
    const ele = data[i];
    var handler = new htmlparser.DefaultHandler(function (error, dom) {
      if (!error) {
        if (dom[0].name != "div") return;
        const tags = dom[0].children.filter((obj) => obj.type == "tag");
        const innerTag = tags[0].children.filter((obj) => obj.type == "tag")[0];
        const cellValue = innerTag.attribs["aria-label"];

        const index = parseInt(dom[0].attribs["data-cell-idx"]);
        const grid_i = Math.floor(index / 6);
        const grid_j = index % 6;
        if (cellValue == "Sun") {
          grid[grid_i][grid_j].value = 2;
          grid[grid_i][grid_j].disabled = true;
        } else if (cellValue == "Moon") {
          grid[grid_i][grid_j].value = 3;
          grid[grid_i][grid_j].disabled = true;
        }

        for (let j = 1; j < tags.length; ++j) {
          const tag = tags[j];
          const innerTag = tag.children.filter((obj) => obj.type == "tag")[0];
          const symbol = innerTag.attribs["aria-label"] == "Cross" ? 3 : 4;
          if (tag.attribs.class.includes("lotka-cell-edge--right")) {
            grid[grid_i][grid_j + 1].leftSymbol = symbol;
          } else {
            grid[grid_i + 1][grid_j].topSymbol = symbol;
          }
        }
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
    CHAT_WEBHOOK: process.env.TANGO_CHAT_WEBHOOK,
    GRID_TYPE: 1,
    LAST_FETCHED_FILE: "latest_tango.txt",
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    PAGE_LINK: "https://www.linkedin.com/games/view/tango/desktop",
  },
  scrapeTango,
  makeGrid,
  "Tango",
  process.argv.includes("test")
);

util.run();
