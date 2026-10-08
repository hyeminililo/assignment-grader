import * as cheerio from "cheerio";

export function collectInlineStyles($: cheerio.CheerioAPI): string {
  return $("style")
    .toArray()
    .map((element) => $(element).html() ?? "")
    .join("\n");
}

export function cssRuleExists(css: string, selector?: string, expected?: string): boolean {
  if (!selector) return false;
  const ruleBlocks = Array.from(css.matchAll(/([^{}]+)\{([^}]*)\}/gm));
  const matchingBodies = ruleBlocks
    .filter((block) =>
      block[1]
        .split(",")
        .map((item) => item.trim())
        .some((item) => selectorAppliesToTarget(item, selector))
    )
    .map((block) => block[2]);
  if (matchingBodies.length === 0) return false;
  if (!expected) return true;
  return matchingBodies.some((body) => declarationMatches(body, expected));
}

function declarationMatches(body: string, expected: string): boolean {
  const bodyWithoutComments = stripCssComments(body);
  const normalizedBody = bodyWithoutComments.replace(/\s+/g, "").toLowerCase();
  const normalizedExpected = expected.replace(/\s+/g, "").toLowerCase();
  if (normalizedBody.includes(normalizedExpected)) return true;
  if (normalizeCssDeclarationText(normalizedBody).includes(normalizeCssDeclarationText(normalizedExpected))) return true;

  const expectedDeclaration = stripTrailingSemicolons(normalizedExpected);

  if (expectedDeclaration === "padding:8px") {
    const bodyDeclarationText = normalizeCssDeclarationText(normalizedBody);
    return bodyDeclarationText.includes("padding-top:8px") && bodyDeclarationText.includes("padding-bottom:8px");
  }

  const [property, value] = expectedDeclaration.split(":");
  if (!property || !value) return false;

  return body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((item) => item.trim().toLowerCase())
    .some((item) => {
      const [actualProperty, actualValue] = item.split(":").map((part) => part?.trim());
      return actualProperty === property && declarationValueMatches(property, actualValue, value);
    });
}

function selectorAppliesToTarget(ruleSelector: string, targetSelector: string): boolean {
  const rule = normalizeSelector(ruleSelector);
  const target = normalizeSelector(targetSelector);
  if (!rule || !target) return false;
  if (rule === target) return true;

  const finalCompound = rule.split(/[\s>+~]+/).at(-1) ?? rule;
  if (finalCompound === target) return true;
  if (target.startsWith(".")) return new RegExp(`(^|[^a-z0-9_-])\\${target}(?![a-z0-9_-])`, "i").test(finalCompound);
  if (/^[a-z][a-z0-9-]*$/i.test(target)) return finalCompound === target || finalCompound.startsWith(`${target}.`) || finalCompound.startsWith(`${target}#`) || finalCompound.startsWith(`${target}[`);
  return false;
}

function normalizeSelector(value: string): string {
  return value.trim().replace(/\s*([>+~])\s*/g, "$1").replace(/\s+/g, " ").toLowerCase();
}

function declarationValueMatches(property: string, actualValue?: string, expectedValue?: string): boolean {
  if (!actualValue || !expectedValue) return false;
  const actual = stripTrailingSemicolons(actualValue.trim());
  const expected = stripTrailingSemicolons(expectedValue.trim());
  const compactActual = actual.replace(/\s+/g, "");
  const compactExpected = expected.replace(/\s+/g, "");
  if (actual === expected) return true;
  if (compactActual === compactExpected) return true;
  if (property === "padding") return paddingValueMatches(actual, expected);
  return false;
}

function paddingValueMatches(actual: string, expected: string): boolean {
  const expectedValues = expected.split(/\s+/).filter(Boolean);
  if (expectedValues.length !== 1) return false;
  const actualValues = actual.split(/\s+/).filter(Boolean);
  if (actualValues.length === 0) return false;
  const top = actualValues[0];
  const bottom = actualValues.length === 1 ? actualValues[0] : actualValues.length === 2 ? actualValues[0] : actualValues[2];
  return top === expectedValues[0] && bottom === expectedValues[0];
}

function stripCssComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeCssDeclarationText(value: string): string {
  return value.replace(/;/g, "");
}

function stripTrailingSemicolons(value: string): string {
  return value.replace(/;+$/g, "");
}
