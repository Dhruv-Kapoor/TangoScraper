
// 30 12 * * * /home/dhruv/.nvm/versions/node/v18.16.0/bin/node /home/dhruv/Desktop/crons/fetch_mini_sudoku.js
console.log("Fetch mini-sudoku running");

const { ScrapeUtil } = require("./utils");

async function scrapeMiniSudoku(pageLink, cookies) {
	console.log("Scraping mini-sudoku");
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
			document.querySelectorAll(".sudoku-cell")
		);
		let cells = elements.map((element) => {
			return element.outerHTML;
		});
		return cells;
	});

	await browser.close();

	console.log("Scraping mini-sudoku complete");
	return data;
}

async function makeGrid(data) {
	console.log("Transforming into mini-sudoku grid");
	const htmlparser = require("htmlparser");
	const size = 6;

	const grid = [];
	for (let i = 0; i < size; ++i) {
		const ar = [];
		for (let j = 0; j < size; ++j) {
			ar.push({
				value: null,
				disabled: false,
			});
		}
		grid.push(ar);
	}

	for (let i = 0; i < data.length; i++) {
		const ele = data[i];
		var handler = new htmlparser.DefaultHandler(function (error, dom) {
			if (!error && dom[0] && dom[0].name === "div") {
				const index = parseInt(dom[0].attribs["data-cell-idx"]);
				const grid_i = Math.floor(index / size);
				const grid_j = index % size;
				let value = null;
				let disabled = false;
				const contentTag = dom[0].children.find(
					(child) => child.type === "tag" && child.attribs["class"] === "sudoku-cell-content"
				);
				if (contentTag) {
					const text = contentTag.children
						.filter((c) => c.type === "text")
						.map((c) => c.data.trim())
						.find((t) => t !== "");
					if (text) {
						value = parseInt(text);
						disabled = true;
					}
				}
				grid[grid_i][grid_j] = { value, disabled };
			}
		});
		var parser = new htmlparser.Parser(handler);
		parser.parseComplete(ele);
	}

	console.log("Transforming mini-sudoku grid complete");
	return grid;
}

const util = new ScrapeUtil(
	{
		CHAT_WEBHOOK: process.env.MINI_SUDOKU_CHAT_WEBHOOK,
		GRID_TYPE: 4,
		LAST_FETCHED_FILE: "latest_mini_sudoku.txt",
		FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
		PAGE_LINK: 'https://www.linkedin.com/games/view/mini-sudoku/desktop/'
	},
	scrapeMiniSudoku,
	makeGrid,
	"Mini Sudoku",
	process.argv.includes('test'),
	true,
	true,
);

util.run();
