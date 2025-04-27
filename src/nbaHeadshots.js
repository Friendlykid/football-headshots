import { createWriteStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { scrapeHeadshot } from "./getFoxHeadshot.js";

const SPORTNAME = "nba";

const CONCURRENCY_LIMIT = 5;

const main = async (count = 0) => {
	if (count > 10) return;
	const browser = await chromium.launch({ headless: true });
	const linksFile = await readFile(
		path.join(process.cwd(), "data", `${SPORTNAME}_players.csv`),
		{ encoding: "utf8" },
	);

	const linksMissingPath = path.join(
		process.cwd(),
		"data",
		`${SPORTNAME}_links_not_on_fox.csv`,
	);

	if (!existsSync(linksMissingPath)) {
		const createStream = createWriteStream(linksMissingPath);
		createStream.end();
	}

	const missingLinksFile = await readFile(linksMissingPath, {
		encoding: "utf8",
	});

	const missingLinks = missingLinksFile.split("\n").map((link) => link.trim());

	const links = linksFile
		.split("\n")
		.map((link) => link.trim())
		.filter(
			(link) =>
				link &&
				!existsSync(
					path.join("data", `${SPORTNAME}_players`, "headshots", `${link}.png`),
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
				await scrapeHeadshot({ browser: browser, name: link, sport: "nba" });
			}),
		);
	}
	await browser.close();
	return await main(count + 1);
};

main().catch((e) => {
	console.error("Unexpected error:", e);
});
