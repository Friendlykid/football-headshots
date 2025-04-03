import path from "path";
import { appendFile } from "fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(
	"https://www.mlssoccer.com/stats/players/#season=2025&competition=mls-regular-season&club=all&statType=general&position=all",
);
page.setViewportSize({ width: 1500, height: 1000 });

page.on("console", (msg) => {
	console.log(msg);
});

await page.waitForTimeout(3000);
await page
	.getByRole("button", { name: "Reject Non-Essential Cookies" })
	?.click?.();

await page.waitForSelector("tbody.mls-o-table__body");

for await (const _item of Array.from({ length: 100 })) {
	await page.waitForTimeout(3000);
	const data = await page.evaluate(() => {
		const rows = Array.from(document.querySelectorAll("tbody tr"));
		console.log(rows.length);
		return rows.map((row) => {
			const cells = Array.from(row.querySelectorAll("td"));
			const textData = cells.map((cell) => cell.innerText.trim());
			const link = row.querySelector("a")?.href || null;
			return { text: textData, href: link };
		});
	});
	const links = data.map((row) => row?.href?.split?.("/")?.pop?.());

	const csvContent = data
		.map((row, i) => {
			console.log(row.href);
			return [links[i], row.text.slice(1, -1)].join(",");
		})
		.join("\n");

	await appendFile(
		path.join(process.cwd(), "data", "mls.csv"),
		csvContent,
		"utf8",
	);

	await appendFile(
		path.join(process.cwd(), "data", "links.csv"),
		links.join("\n"),
		"utf8",
	);
	const nextButton = page.getByRole("button", { name: "Next results" });
	if (!nextButton) break;
	await page.getByRole("button", { name: "Next results" }).click();
}

await browser.close();
