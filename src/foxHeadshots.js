import { existsSync } from "fs";
import path from "path";
import { appendFile, readFile } from "fs/promises";
import { chromium } from "playwright";

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));

const RETRY_COUNT = Number(process.env.RETRY_COUNT ?? 5);

const gotoUrl = async (page, url, name, errorCount = 0, errorMessage = "") => {
	if (errorCount > RETRY_COUNT)
		return {
			isError: true,
			errorMessage: `Exceeded number of retries\n${errorMessage}`,
		};

	try {
		await page.goto(url, { timeout: 30_000, waitUntil: "domcontentloaded" });
		await page.setViewportSize({ width: 1500, height: 1000 });
		await page.waitForTimeout(3000);
		return { isError: false };
	} catch (e) {
		if (page.url() === "https://www.foxsports.com/soccer") {
			await appendFile(
				path.join(process.cwd(), "data", "links_not_on_fox.csv"),
				`${name}\n`,
			);
			return { isError: true, errorMessage: "does not exist" };
		}
		console.log(`Retrying [${errorCount}] for: ${url}`);
		console.log(page.url());
		await sleep(1000);
		return await gotoUrl(page, url, name, errorCount + 1, e.message);
	}
};

const scrapeHeadshot = async (browser, name) => {
	const page = await browser.newPage();
	const baseUrl = `https://www.foxsports.com/soccer/${name}-player`;
	const { isError, errorMessage = "" } = await gotoUrl(page, baseUrl, name);
	if (isError || page.url() !== baseUrl) {
		errorMessage && console.log(errorMessage);
		await page.close();
		return;
	}
	const imageLink = await page.evaluate(() => {
		return document.querySelector("img.image-headshot")?.getAttribute?.("src");
	});
	if (!imageLink || imageLink.split("/").pop().startsWith("default-headshot")) {
		console.log(imageLink, baseUrl);
		await page.close();
		return;
	}
	const result = await gotoUrl(page, imageLink);

	if (result.isError) {
		await page.close();
		return;
	}
	console.log("adding image to player ", name);
	await page.locator("img").screenshot({
		path: path.join("data", "mls_players", "headshots", `${name}.png`),
	});
	await page.close();
};

const CONCURRENCY_LIMIT = Number(process.env.CONCURRENCY_LIMIT ?? 10);

const main = async (count = 0) => {
	if (count > 10) return;
	const browser = await chromium.launch({ headless: true });
	const linksFile = await readFile(
		path.join(process.cwd(), "data", "links_deduped.csv"),
		{ encoding: "utf8" },
	);

	const missingLinksFile = await readFile(
		path.join(process.cwd(), "data", "links_not_on_fox.csv"),
		{ encoding: "utf8" },
	);

	const missingLinks = missingLinksFile.split("\n").map((link) => link.trim());

	const links = linksFile
		.split("\n")
		.map((link) => link.trim())
		.filter(
			(link) =>
				link &&
				!existsSync(
					path.join("data", "mls_players", "headshots", `${link}.png`),
				),
		)
		.filter((link) => !missingLinks.includes(link));
	console.log(links.length);
	if (links.length === 0) return;
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
	return await main(count + 1);
};

main().catch((e) => {
	console.error("Unexpected error:", e);
});
