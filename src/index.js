import path from "path";
import { readFile, writeFile } from "fs/promises";
import YahooFantasy from "yahoo-fantasy";

const yf = new YahooFantasy(process.env.CLIENT_ID, process.env.CLIENT_SECRET);

const sleep = async (time) =>
	new Promise((resolve) => setTimeout(resolve, time));
/*
const gamesFile = await readFile(path.join("data", "games.json"), {
	encoding: "utf8",
});
const games = JSON.parse(gamesFile);

const filledGames = [];
for (let i = 0; i < games.length; i += 10) {
	const chunk = games.slice(i, i + 10);
	const res = await yf.games.fetch(
		chunk.map((game) => game.game_key),
		["stat_categories"],
	);
	console.log(res);
	filledGames.push(...res);
}

writeFile(path.join("data", "stats.json"), JSON.stringify(filledGames), {
	encoding: "utf8",
});
*/
const gameKey = "nba"; // Change this to the correct game key
const start = 0; // Start at 0 for pagination

const gameMeta = await yf.player.stats("328.p.6619");

//const a = await yf.player.meta("15.p.3");

console.log(gameMeta.stats.stats);
//console.log(info.game_weeks, info.roster_positions);
