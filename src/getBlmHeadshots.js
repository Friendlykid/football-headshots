import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { downloadImage } from "./downloadImage.js";

const scrapeHeadshot = async (url) => {
	const response = await fetch(url);
	if (!response.ok) return;
	const pageText = await response.text();
	const dom = new JSDOM(pageText);
	const imageLink = dom.window.document
		.querySelector("img.player-headshot")
		?.getAttribute?.("src");

	if (!imageLink) return;

	await downloadImage(
		imageLink.replace("w_213", "w_450"),
		path.join(
			process.cwd(),
			"data",
			"bml_players",
			"headshots",
			`${url.replace("https://www.mlb.com/player/", "").replace(/-\d+/, "")}.png`,
		),
	);
};

const CONCURRENCY_LIMIT = 5;

(async () => {
	const linksFile = await readFile(
		path.join(process.cwd(), "data", "bml_players", "player_links.csv"),
		{ encoding: "utf-8" },
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

	for await (const link of links) {
		await scrapeHeadshot(link);
	}
})();
