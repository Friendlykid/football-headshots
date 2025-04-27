import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const playerListFile = await readFile(
	path.join(process.cwd(), "data", "nba_player_list.csv"),
	{ encoding: "utf-8" },
);

const names = playerListFile
	.split("\n")
	.map((playerString) => playerString.split(",")[1])
	.filter(Boolean)
	.map((player) =>
		player
			.trim()
			.toLowerCase()
			.normalize("NFC")
			.replaceAll(".", "")
			.replaceAll(" ", "-"),
	);

await writeFile(
	path.join(process.cwd(), "data", "nba_players.csv"),
	names.join("\n"),
	{ encoding: "utf-8" },
);
