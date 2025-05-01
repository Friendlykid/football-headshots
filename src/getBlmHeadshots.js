import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { downloadImage } from "./downloadImage.js";

const scrapeHeadshot = async (url) => {
	console.log("fetching: ", url);
	const response = await fetch(url);
	if (!response.ok) return;
	const pageText = await response.text();
	const dom = new JSDOM(pageText);
	const imageLink = dom.window.document
		.querySelector("img.player-headshot")
		?.getAttribute?.("src");
	console.log("image link: ", imageLink);

	if (!imageLink) return;

	const name = url
		.replace("https://www.mlb.com/player/", "")
		.replace(/-\d+/, "");

	if (
		existsSync(
			path.join(
				process.cwd(),
				"data",
				"bml_players",
				"headshots",
				`${name}.png`,
			),
		)
	) {
		return;
	}
	await downloadImage(
		imageLink.replace("w_213", "w_450"),
		path.join(process.cwd(), "data", "bml_players", "headshots", `${name}.png`),
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

	for await (const link of links) {
		await scrapeHeadshot(link);
	}
})();
