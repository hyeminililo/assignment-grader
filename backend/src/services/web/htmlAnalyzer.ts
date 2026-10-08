import fs from "node:fs/promises";
import * as cheerio from "cheerio";

export async function loadHtml(filePath: string) {
  const html = await fs.readFile(filePath, "utf8");
  return { html, $: cheerio.load(html) };
}

export function elementExists($: cheerio.CheerioAPI, selector?: string): boolean {
  return Boolean(selector && $(selector).length > 0);
}

export function textContains($: cheerio.CheerioAPI, expected?: string): boolean {
  return Boolean(expected && $.root().text().includes(expected));
}

export function titleContains($: cheerio.CheerioAPI, expected?: string): boolean {
  return Boolean(expected && $("title").text().includes(expected));
}

export function titleMatches($: cheerio.CheerioAPI, expected?: string): boolean {
  if (!expected) return false;
  return new RegExp(expected).test($("title").text().trim());
}

export function attributeEquals($: cheerio.CheerioAPI, selector?: string, attribute?: string, expected?: string): boolean {
  if (!selector || !attribute) return false;
  return $(selector).toArray().some((element) => $(element).attr(attribute) === expected);
}
