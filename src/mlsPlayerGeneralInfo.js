import path from "path";
import { appendFile, readFile } from "fs/promises";
import { chromium } from "playwright";

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));

const positions = [
	"name",
	"height",
	"weight",
	"date of birth",
	"birthplace",
	"position",
	"footedness",
	"roster category",
	"player category",
	"position detail",
	"preferred side",
];

const gotoUrl = async (page, url) => {
	try {
		await page.goto(url);
	} catch (e) {
		await sleep(1000);
		await gotoUrl(page, url);
	}

	await page.setViewportSize({ width: 1500, height: 1000 });
	await page.waitForTimeout(3000);

	// Handle cookies
	const rejectCookiesBtn = await page.getByRole("button", {
		name: "Reject Non-Essential Cookies",
	});
	if (await rejectCookiesBtn.isVisible()) {
		await rejectCookiesBtn.click();
	}
};

const scrapePlayerInfo = async (browser, name) => {
	const page = await browser.newPage();
	const baseUrl = `https://www.mlssoccer.com/players/${name}/`;
	await gotoUrl(page, baseUrl);

	const data = await page.evaluate(() => {
		return Array.from(
			document.querySelectorAll(
				"div.mls-l-module--player-status-details__container > div",
			),
		).map((div) => {
			const h3 = div.querySelector("h3")?.innerText?.trim?.();
			const span = div.querySelector("span")?.innerText?.trim?.();
			return { title: h3, value: span };
		});
	});
	const playerData = Array.from({ length: positions.length }).fill(null);
	data.forEach(({ title, value }) => {
		if (!positions.includes(title.toLowerCase())) return;
		playerData[positions.indexOf(title.toLowerCase())] = value;
	});
	await appendFile(
		path.join(
			process.cwd(),
			"data",
			"mls_players",
			"mls_players_general_info.csv",
		),
		`${[name, ...playerData].join(";")}\n`,
		{ encoding: "utf8" },
	);
	await page.close();
};

const CONCURRENCY_LIMIT = 10;

const main = async () => {
	const browser = await chromium.launch();
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
				await scrapePlayerInfo(browser, link);
			}),
		);
	}
	await browser.close();
};

main();
