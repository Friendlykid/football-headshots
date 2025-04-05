import { existsSync } from "fs";
import path from "path";
import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { chromium } from "playwright";

const gotoPlayer = async (name, page) => {
	await page.goto(`https://www.mlssoccer.com/players/${name}/`, {
		waitUntil: "domcontentloaded",
	});
	page.setViewportSize({ width: 1500, height: 1000 });
	await page.waitForTimeout(3000);
};

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
		mkdir(dirPath);
	}
};

const namesFile = await readFile(
	path.join(process.cwd(), "data", "links.csv"),
	{ encoding: "utf8" },
);
const names = namesFile.split("\n").filter(Boolean);
const browser = await chromium.launch();
const page = await browser.newPage();

page.on("console", (msg) => {
	console.log(msg);
});
for await (const name of names) {
	const dirPath = path.join(process.cwd(), "data", "mls_players", name);
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
	const playerData = Array.from({ length: 9 }).fill(null);
	data.forEach(({ title, value }) => {
		if (!positions.includes(title.toLowerCase())) return undefined;
		playerData[positions.indexOf(title.toLowerCase())] = value;
	});
	await appendFile(
		path.join(
			process.cwd(),
			"data",
			"mls_players",
			"basic_info",
			"players_basic_info_2025",
		),
		`${JSON.stringify(playerData.join(";")).replace(/(^")|("$)/, "")}\n`,
		{ encoding: "utf8" },
	);
}

await browser.close();
