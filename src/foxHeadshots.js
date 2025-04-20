import path from "path";
import { appendFile, readFile } from "fs/promises";
import { chromium } from "playwright";

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));

const gotoUrl = async (page, url, errorCount = 0, errorMessage = "") => {
	if (errorCount > 10) return { isError: true, errorMessage };

	try {
		await page.goto(url, { timeout: 60_000, waitUntil: "domcontentloaded" });
		await page.setViewportSize({ width: 1500, height: 1000 });
		await page.waitForTimeout(3000);
		return { isError: false };
	} catch (e) {
		console.log(`Retrying [${errorCount}] for: ${url}`);
		await sleep(1000);
		return await gotoUrl(page, url, errorCount + 1, e.message);
	}
};

const scrapeHeadshot = async (browser, name) => {
	const page = await browser.newPage();
	const baseUrl = `https://www.foxsports.com/soccer/${name}-player`;
	const { isError, errorMessage } = await gotoUrl(page, baseUrl);
	if (isError) {
		console.log("skipping ", baseUrl, errorMessage);
		return;
	}
	if (page.url() !== baseUrl) return;
	const imageLink = await page.evaluate(() => {
		return document.querySelector("img.image-headshot").getAttribute("src");
	});
	if (imageLink.split("/").pop().startsWith("default-headshot")) return;
	await gotoUrl(page, imageLink);
	await page.locator("img").screenshot({
		path: path.join("data", "mls_players", "headshots", `${name}.png`),
	});
	await page.close();
};

const CONCURRENCY_LIMIT = 10;

const main = async () => {
	const browser = await chromium.launch({ headless: true });
	const linksFile = await readFile(
		path.join(process.cwd(), "data", "links_deduped.csv"),
		{ encoding: "utf8" },
	);
	const links = linksFile.split("\n").map((link) => link.trim());
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
				await scrapeHeadshot(browser, link);
			}),
		);
	}
	await browser.close();
};

main();
