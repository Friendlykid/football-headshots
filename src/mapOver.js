import path from "path";
import { readFile } from "fs/promises";

export const mapOverGameFile = async (callbackFn, index) => {
	const gamesFile = await readFile(
		path.join("data", "games", `games_${index}.json`),
		{
			encoding: "utf8",
		},
	);
	const games = JSON.parse(gamesFile);
	await callbackFn(games, index);
};

export const mapOverGameFiles = async (callbackFn) => {
	for await (const i of [0, 1, 2, 3, 4]) {
		await mapOverGameFile(callbackFn, i);
	}
};

export const mapOverGames = async (callbackFn) => {
	for (let i = 0; i < 5; i++) {
		const gamesFile = await readFile(
			path.join("data", "games", `games_${i}.json`),
			{
				encoding: "utf8",
			},
		);
		const games = JSON.parse(gamesFile);
		for await (const game of games) {
			await callbackFn(game);
		}
	}
};
