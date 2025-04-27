import path from "path";
import { appendFile } from "fs/promises";

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));

const RETRY_COUNT = Number(process.env.RETRY_COUNT ?? 5);

const gotoUrl = async ({
	page,
	url,
	name,
	errorCount = 0,
	errorMessage = "",
	sport,
}) => {
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
		if (page.url() === `https://www.foxsports.com/${sport}`) {
			await appendFile(
				path.join(process.cwd(), "data", `${sport}_links_not_on_fox.csv`),
				`${name}\n`,
			);
			return { isError: true, errorMessage: "does not exist" };
		}
		console.log(`Retrying [${errorCount}] for: ${url}`);
		console.log(page.url());
		await sleep(1000);
		return await gotoUrl({
			page,
			url,
			name,
			errorCount: errorCount + 1,
			errorMessage: e.message,
			sport,
		});
	}
};
/**
 *
 * @param {import("playwright").Browser} browser
 * @param {string} name
 */
export const scrapeHeadshot = async ({ browser, name, sport }) => {
	const page = await browser.newPage();

	const baseUrl = `https://www.foxsports.com/${sport}/${name}-player`;
	const { isError, errorMessage = "" } = await gotoUrl({
		page,
		url: baseUrl,
		name,
		sport,
	});
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
	const result = await gotoUrl({
		page,
		url: imageLink,
		name,
		sport,
	});

	if (result.isError) {
		await page.close();
		return;
	}
	console.log("adding image to player ", name);
	await page.locator("img").screenshot({
		path: path.join("data", `${sport}_players`, "headshots", `${name}.png`),
	});
	await page.close();
};
