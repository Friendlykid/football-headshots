import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { existsSync } from "node:fs";

import { chromium } from "playwright";
import { downloadImage } from "./downloadImage.js";
const SPORTNAME = "nba";

const filterPath = path.join(process.cwd(), "data", "nbaLinksSaved.csv");

const RETRY_COUNT = 5;

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));

const gotoUrl = async ({ page, url, errorCount = 0 }) => {
	if (errorCount > RETRY_COUNT)
		return {
			isError: true,
			errorMessage: `Exceeded number of retries\n${errorMessage}`,
		};

	try {
		await page.goto(url, { timeout: 30_000 });
		await page.setViewportSize({ width: 1500, height: 1000 });
		await page.waitForTimeout(3000);
		return { isError: false };
	} catch (e) {
		console.log(e);
		await sleep(1000);
		return await gotoUrl({
			page,
			url,
			errorCount: errorCount + 1,
		});
	}
};

/**
 *
 * @param {import("playwright").Browser} browser
 * @param {string} link
 */
const scrapeNbaHeadshot = async (browser, link) => {
	const page = await browser.newPage();
	await gotoUrl({ page, url: link });
	if (page.url() !== link) return;
	const name = await page.locator("h1").innerText({ timeout: 10_000 });
	const formattedName = name.replace("\n", "-").toLowerCase();
	if (
		existsSync(
			path.join(
				process.cwd(),
				"data",
				"nba_players",
				"headshots",
				`${formattedName}.png`,
			),
		)
	) {
		await appendFile(
			path.join(process.cwd(), "data", "nbaLinksSaved.csv"),
			`${link}\n`,
		);
		return;
	}
	const imageHref = await page
		.locator("img.PlayerImage_image__wH_YX")
		.getAttribute("src");

	if (
		imageHref === "https://cdn.nba.com/headshots/nba/latest/1040x760/243.png" ||
		!imageHref
	) {
		return;
	}

	await downloadImage(
		imageHref,
		path.join(
			process.cwd(),
			"data",
			"nba_players",
			"headshots",
			`${formattedName}.png`,
		),
		async () => {
			await appendFile(filterPath, `${formattedName}\n`, { encoding: "utf-8" });
		},
	);
};

const CONCURRENCY_LIMIT = 5;

const main = async (count = 0) => {
	const file = await readFile(
		path.join(process.cwd(), "data", "final_nba_id.csv"),
		{
			encoding: "utf-8",
		},
	);

	const filterFile = await readFile(filterPath, { encoding: "utf-8" });

	const links = [...new Set(file.split(/(,)|($)/).filter(Boolean))]
		.filter((link) => link !== ",")
		.filter((link) => !filterFile.split("\n").includes(link))
		.map((link) => link.replaceAll("\\n", "").replaceAll("\\r", ""));

	if (count > 10) return;
	const browser = await chromium.launch({ headless: true });

	const chunks = Array.from(
		{ length: Math.ceil(links.length / CONCURRENCY_LIMIT) },
		(_, i) =>
			links.slice(
				i * CONCURRENCY_LIMIT,
				i * CONCURRENCY_LIMIT + CONCURRENCY_LIMIT,
			),
	);

	for await (const chunk of chunks) {
		await Promise.all(
			chunk.map(async (link) => {
				await scrapeNbaHeadshot(browser, link);
			}),
		);
	}
	await browser.close();
	return await main(count + 1);
};

main().catch((e) => {
	console.error("Unexpected error:", e);
});
