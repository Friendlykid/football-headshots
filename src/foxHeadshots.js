import path from "path";
import { appendFile, readFile } from "fs/promises";
import { chromium } from "playwright";

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));

const gotoUrl = async (page, url) => {
	try {
		await page.goto(url);
	} catch (e) {
		console.log(e);
		await sleep(1000);
		await gotoUrl(page, url);
	}

	await page.setViewportSize({ width: 1500, height: 1000 });
	await page.waitForTimeout(3000);
};

const scrapeHeadshot = async (browser, name) => {
	const page = await browser.newPage();
	const baseUrl = `https://www.foxsports.com/soccer/${name}-player`;
	await gotoUrl(page, baseUrl);
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
	const browser = await chromium.launch({ headless: false });
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
