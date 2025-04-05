import { existsSync } from "fs";
import path from "path";
import { appendFile, mkdir } from "fs/promises";
import { chromium } from "playwright";

const playerCategories = [
	"general",
	"passing",
	"attacking",
	"defending",
	"goalkeeping",
];

const years = Array.from({ length: 30 }, (_, i) => i + 1996);

const ensureDir = async (dirPath) => {
	if (!existsSync(dirPath)) {
		await mkdir(dirPath, { recursive: true });
	}
};

const scrapeYear = async (browser, year, category) => {
	const page = await browser.newPage();
	const position = category === "goalkeeping" ? "goalkeeper" : "all";
	const baseUrl = `https://www.mlssoccer.com/stats/players/#season=${year}&competition=mls-regular-season&club=all&statType=${category}&position=${position}`;

	await page.goto(baseUrl);
	await page.setViewportSize({ width: 1500, height: 1000 });
	await page.waitForTimeout(3000);

	// Handle cookies
	const rejectCookiesBtn = await page.getByRole("button", {
		name: "Reject Non-Essential Cookies",
	});
	if (await rejectCookiesBtn.isVisible()) {
		await rejectCookiesBtn.click();
	}

	await page.waitForSelector("tbody.mls-o-table__body");

	const allData = [];
	const allLinks = new Set();

	const scrapePage = async () => {
		await page.waitForSelector("tbody.mls-o-table__body");

		// Ensure loading spinners are gone
		await page.waitForFunction(
			() => document.querySelectorAll(".mls-o-loading").length === 0,
		);

		const pageData = await page.evaluate(() => {
			const rows = Array.from(document.querySelectorAll("tbody tr"));
			return rows.map((row) => {
				const cells = Array.from(row.querySelectorAll("td"));
				const textData = cells.map((cell) => cell.innerText.trim());
				const link = row.querySelector("a")?.href || null;
				return { text: textData, href: link };
			});
		});

		pageData.forEach((row) => {
			const linkId = row?.href?.split("/")?.pop?.();
			if (linkId) allLinks.add(linkId);
			allData.push([linkId, ...row.text.slice(1)].join(";"));
		});

		const nextBtn = page.locator('button[aria-label="Next results"]');
		const isVisible = await nextBtn.isVisible();
		if (!isVisible) return;

		const isDisabled = await nextBtn.getAttribute("disabled");
		if (isDisabled !== null) return;
		await nextBtn.click();
		await page.waitForTimeout(2000);
		await scrapePage();
	};

	await scrapePage();

	const categoryDir = path.join(process.cwd(), "data", "mls_players", category);
	await ensureDir(categoryDir);

	const filePath = path.join(categoryDir, `${year}_${category}.csv`);
	const linksPath = path.join(process.cwd(), "data", "links.csv");
	console.log("adding ", allData.length, " to ", category, year);
	if (allData.length > 0) {
		await appendFile(filePath, `${allData.join("\n")}\n`, "utf8");
	}

	if (allLinks.size > 0) {
		await appendFile(linksPath, `${Array.from(allLinks).join("\n")}\n`, "utf8");
	}

	await page.close();
};

const CONCURRENCY_LIMIT = 5;

const run = async (category, browser) => {
	const chunks = Array.from(
		{ length: Math.ceil(years.length / CONCURRENCY_LIMIT) },
		(_, i) =>
			years.slice(
				i * CONCURRENCY_LIMIT,
				i * CONCURRENCY_LIMIT + CONCURRENCY_LIMIT,
			),
	);

	for (const chunk of chunks) {
		await Promise.allSettled(
			chunk.map((year) => scrapeYear(browser, year, category)),
		);
	}
};

const main = async () => {
	const browser = await chromium.launch();

	await Promise.all(playerCategories.map((category) => run(category, browser)));

	//await scrapeYear(browser, "2024", "goalkeeping");
	await browser.close();
};

main();
