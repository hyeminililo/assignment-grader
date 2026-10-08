import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import type { WebAction } from "../../types/assignment.js";

export interface BrowserCheckOptions {
  htmlFile: string;
  selector?: string;
  expected?: string;
  mode?: "default" | "hover-style";
  promptInputs?: string[];
  actions?: WebAction[];
  timeoutMs?: number;
}

export async function runBrowserCheck(options: BrowserCheckOptions): Promise<{ passed: boolean; text: string; errors: string[] }> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  const promptInputs = [...(options.promptInputs ?? [])];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    try {
      const value = promptInputs.shift() ?? "0";
      if (dialog.type() === "prompt") await dialog.accept(value);
      else await dialog.accept();
    } catch (error) {
      const message = error instanceof Error ? error.message : "dialog 처리 중 오류";
      if (!message.includes("has been closed")) errors.push(message);
    }
  });

  try {
    await page.goto(pathToFileURL(path.resolve(options.htmlFile)).toString(), { waitUntil: "load", timeout: options.timeoutMs ?? 5000 });
    for (const action of options.actions ?? []) {
      if (action.type === "fill") await page.locator(action.selector).fill(action.value ?? "");
      if (action.type === "click") await page.locator(action.selector).click();
      if (action.type === "submit") await page.locator(action.selector).evaluate((form) => (form as HTMLFormElement).submit());
    }
    await page.waitForTimeout(100);
    const text = await page.locator("body").textContent({ timeout: 1000 }).catch(() => "");
    if (options.mode === "hover-style") {
      if (!options.selector) return { passed: false, text: text ?? "", errors: [...errors, "hover 대상 selector가 없습니다."] };
      const locator = page.locator(options.selector).first();
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) return { passed: false, text: text ?? "", errors: [...errors, `hover 대상을 찾지 못했습니다: ${options.selector}`] };
      await locator.hover();
      await page.waitForTimeout(100);
      const style = await locator.evaluate((element, expectedText) => {
        const expected = String(expectedText ?? "")
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const separator = item.indexOf(":");
            return separator >= 0 ? { property: item.slice(0, separator).trim(), value: item.slice(separator + 1).trim() } : undefined;
          })
          .filter(Boolean) as Array<{ property: string; value: string }>;
        const computed = getComputedStyle(element as Element);
        const normalizeExpected = (property: string, value: string) => {
          if (property.includes("color")) {
            const probe = document.createElement("span");
            probe.style.color = value;
            document.body.appendChild(probe);
            const normalized = getComputedStyle(probe).color;
            probe.remove();
            return normalized.replace(/\s+/g, "").toLowerCase();
          }
          if (property === "font-weight" && value === "bold") return "700";
          if (property === "font-style" && value === "italic") return "italic";
          return value.replace(/\s+/g, "").toLowerCase();
        };
        const normalizeActual = (property: string, value: string) => {
          if (property === "font-weight" && value === "bold") return "700";
          return value.replace(/\s+/g, "").toLowerCase();
        };
        return expected.map(({ property, value }) => {
          const actual = computed.getPropertyValue(property);
          const wanted = normalizeExpected(property, value);
          const got = normalizeActual(property, actual);
          return { property, expected: wanted, actual: got, passed: got === wanted };
        });
      }, options.expected ?? "");
      const failed = style.filter((item) => !item.passed);
      const styleText = style.map((item) => `${item.property}: expected ${item.expected}, actual ${item.actual}`).join("\n");
      return { passed: failed.length === 0 && errors.length === 0, text: styleText, errors };
    }
    const selectorVisible = options.selector ? await page.locator(options.selector).first().isVisible().catch(() => false) : true;
    const textPassed = options.expected ? (text ?? "").includes(options.expected) : true;
    return { passed: selectorVisible && textPassed && errors.length === 0, text: text ?? "", errors };
  } finally {
    await browser.close();
  }
}
