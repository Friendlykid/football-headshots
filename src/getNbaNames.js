import { existsSync } from "fs";
import path from "path";
import { appendFile, mkdir } from "fs/promises";
import { chromium } from "playwright";

const seasonTypes = ["Regular+Season", "Playoffs", "All+Star"];
const years = Array.from({ length: 20 }, (_, i) => i + 4);
const CONCURRENCY_LIMIT = 2;

const ensureDir = async (dirPath) => {
	if (!existsSync(dirPath)) {
		await mkdir(dirPath, { recursive: true });
	}
};

const scrapeYear = async (browser, year, seasonType) => {
	const page = await browser.newPage();
	const baseUrl = `https://www.nba.com/stats/players/traditional?SeasonType=${seasonType}&Season=200${year}-${year + 1}&PerMode=PerGame`;
	await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
	await page.setViewportSize({ width: 1500, height: 1000 });
	await page.waitForSelector("tbody.Crom_body__UYOcU", { timeout: 10000 });

	const allData = [];
	const allNames = new Set();

	const scrapePage = async () => {
		const pageData = await page.evaluate(() => {
			const rows = Array.from(
				document.querySelectorAll("tbody.Crom_body__UYOcU tr"),
			);
			return rows.map((row) => {
				const cells = Array.from(row.querySelectorAll("td"));
				return cells.map((cell) => cell.innerText.trim());
			});
		});

		pageData.forEach((textData) => {
			const rawName = textData[1];
			const name = rawName
				.trim()
				.toLowerCase()
				.normalize("NFC")
				.replaceAll(".", "")
				.replaceAll(" ", "-");
			allNames.add(name);
			allData.push([name, ...textData.slice(2)].join(";"));
		});

		const nextBtn = page.getByRole("button", { name: "Next Page Button" });
		const isVisible = await nextBtn.isVisible().catch(() => false);
		if (!isVisible) return;

		const isDisabled = await nextBtn.getAttribute("disabled");
		if (isDisabled !== null) return;

		await Promise.all([
			nextBtn.click(),
			page.waitForResponse(
				(res) => res.url().includes("stats/players") && res.status() === 200,
			),
		]);

		await scrapePage(); // recursion
	};

	await scrapePage();

	const categoryDir = path.join(
		process.cwd(),
		"data",
		"nba_players",
		seasonType,
	);
	await ensureDir(categoryDir);

	const filePath = path.join(categoryDir, `${year}_${seasonType}.csv`);
	const namesPath = path.join(process.cwd(), "data", "nba_names.csv");

	console.log(`Adding ${allData.length} players for ${seasonType} ${year}`);

	if (allData.length > 0) {
		await appendFile(filePath, `${allData.join("\n")}\n`, "utf8");
	}
	if (allNames.size > 0) {
		await appendFile(namesPath, `${Array.from(allNames).join("\n")}\n`, "utf8");
	}

	await page.close();
};

const run = async (seasonType, browser) => {
	const chunks = Array.from(
		{ length: Math.ceil(years.length / CONCURRENCY_LIMIT) },
		(_, i) => years.slice(i * CONCURRENCY_LIMIT, (i + 1) * CONCURRENCY_LIMIT),
	);

	for (const chunk of chunks) {
		await Promise.all(
			chunk.map((year) => scrapeYear(browser, year, seasonType)),
		);
	}
};

const main = async () => {
	const browser = await chromium.launch();
	await Promise.all(seasonTypes.map((seasonType) => run(seasonType, browser)));
	await browser.close();
};

main();
