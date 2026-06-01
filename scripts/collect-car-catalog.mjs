import { mkdir, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://forza.net/fh6cars?pubDate=20260123";
const OUTPUT_PATH = new URL("../src/data/carCatalog.json", import.meta.url);

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseClass(rawClass) {
  const match = rawClass.match(/^(\d+)\s+([A-Z]\d?)$/);
  if (!match) {
    return {
      pi: null,
      class: rawClass || null,
    };
  }
  return {
    pi: Number(match[1]),
    class: match[2],
  };
}

function splitList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRows(html) {
  const tableMatch = html.match(/<table>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (!tableMatch) {
    throw new Error("Could not find FH6 car table in source HTML.");
  }

  return [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) =>
      decodeHtml(cell[1].replace(/<[^>]*>/g, "")),
    );
    if (cells.length !== 7) {
      throw new Error(`Unexpected car row shape: ${cells.length} cells.`);
    }

    const [make, carName, carType, rawClass, country, collection, addOns] = cells;
    const parsedClass = parseClass(rawClass);
    const id = slugify(`${make}-${carName}`);

    return {
      id,
      make,
      carName,
      carType,
      initialClass: parsedClass.class,
      initialPI: parsedClass.pi,
      rawClass,
      country,
      collection: splitList(collection),
      addOns: splitList(addOns),
      sourceIds: ["forza_official_fh6_car_list"],
    };
  });
}

const response = await fetch(SOURCE_URL, {
  headers: {
    "user-agent": "Forza-Horizon-Tune-Coach data collector",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch car list: ${response.status} ${response.statusText}`);
}

const html = await response.text();
const cars = parseRows(html);

const payload = {
  meta: {
    sourceId: "forza_official_fh6_car_list",
    sourceUrl: SOURCE_URL,
    collectedAt: new Date().toISOString(),
    rowCount: cars.length,
    notes: "Parsed from the official Forza Horizon 6 car list table. Re-run this script when the official page updates.",
  },
  cars,
};

await mkdir(new URL("../src/data", import.meta.url), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote ${cars.length} cars to ${OUTPUT_PATH.pathname}`);
