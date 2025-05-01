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
	const pitch = await readFile(
		path.join(process.cwd(), "data", "bml_players", "pitching_urls.csv"),
		{
			encoding: "utf-8",
		},
	);

	const hit = await readFile(
		path.join(process.cwd(), "data", "bml_players", "hitting_urls.csv"),
		{
			encoding: "utf-8",
		},
	);

	const pitchArr = [
		...new Set(
			pitch.split("\n").flatMap((line) => line.replace(/,{2,}/, "").split(",")),
		),
	];

	const hitArr = [
		...new Set(
			hit.split("\n").flatMap((line) => line.replace(/,{2,}/, "").split(",")),
		),
	];

	const links = [...new Set([...pitchArr, ...hitArr])];

	//const links = linksFile.split("\n").map((link) => link.trim());
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
