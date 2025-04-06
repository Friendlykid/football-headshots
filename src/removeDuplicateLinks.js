import path from "path";
import { readFile, writeFile } from "fs/promises";

const linksFile = await readFile(
	path.join(process.cwd(), "unique_names2.txt"),
	{ encoding: "utf8" },
);

const links = [...new Set(linksFile.split("\n").map((link) => link.trim()))];

writeFile(
	path.join(process.cwd(), "data", "links_deduped.csv"),
	links.join("\n"),
);
