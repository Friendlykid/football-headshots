import { existsSync } from "fs";
import path from "path";
import { appendFile, mkdir, readFile } from "fs/promises";
import { chromium } from "playwright";

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
];

const createDir = async (dirPath) => {
	if (!existsSync(dirPath)) {
		await mkdir(dirPath, { recursive: true });
	}
};

const gotoPlayer = async (name, page) => {
	await page.goto(`https://www.mlssoccer.com/players/${name}/`, {
		waitUntil: "domcontentloaded",
	});
	await page.setViewportSize({ width: 1500, height: 1000 });
	await page.waitForTimeout(3000);
};

const scrapePlayer = async (browser, name) => {
	const page = await browser.newPage();
	try {
		await gotoPlayer(name, page);
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
				"basic_info",
				"players_basic_info_2025.csv",
			),
			`${JSON.stringify(playerData.join(";")).replace(/(^")|("$)/g, "")}\n`,
			{ encoding: "utf8" },
		);
	} catch (err) {
		console.error(`Error processing ${name}:`, err.message);
	} finally {
		await page.close();
	}
};

const CONCURRENCY_LIMIT = 10;

const run = async () => {
	const namesFile = await readFile(
		path.join(process.cwd(), "data", "links.csv"),
		{
			encoding: "utf8",
		},
	);
	const names = namesFile.split("\n").filter(Boolean);

	const browser = await chromium.launch();

	// Process players in chunks to limit concurrency
	const chunks = Array.from(
		{ length: Math.ceil(names.length / CONCURRENCY_LIMIT) },
		(_, i) =>
			names.slice(
				i * CONCURRENCY_LIMIT,
				i * CONCURRENCY_LIMIT + CONCURRENCY_LIMIT,
			),
	);

	for (const chunk of chunks) {
		await Promise.allSettled(chunk.map((name) => scrapePlayer(browser, name)));
	}

	await browser.close();
};

run();
