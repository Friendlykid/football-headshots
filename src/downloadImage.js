import { createWriteStream } from "node:fs";

import { pipeline } from "node:stream";
import { promisify } from "node:util";

const streamPipeline = promisify(pipeline);

export const downloadImage = async (url, path, callback = async () => {}) => {
	const response = await fetch(url);
	if (!response.ok) {
		await callback();
		return;
	}

	await streamPipeline(response.body, createWriteStream(path));
	console.log("Image saved to", path);
};
