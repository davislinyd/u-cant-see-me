import { describe, expect, it } from "vitest";
import { MESSAGES, resolveLanguage, translate } from "../../src/shared/i18n";
import { DEFAULT_SETTINGS } from "../../src/shared/constants";

describe("i18n", () => {
  it("keeps en and zh-Hant key sets identical", () => {
    const enKeys = Object.keys(MESSAGES.en).sort();
    const zhKeys = Object.keys(MESSAGES["zh-Hant"]).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("resolves the configured language with English fallback", () => {
    expect(resolveLanguage({ language: "zh-Hant" })).toBe("zh-Hant");
    expect(resolveLanguage({ language: "en" })).toBe("en");
    expect(resolveLanguage(null)).toBe("en");
    expect(resolveLanguage(undefined)).toBe("en");
    expect(resolveLanguage({ language: "fr" as never })).toBe("en");
  });

  it("translates with interpolation", () => {
    expect(translate("popup.detail.status", "en", { active: 3, unresolved: 1 })).toBe("Active masks: 3 · Unresolved: 1");
    expect(translate("popup.detail.status", "zh-Hant", { active: 3, unresolved: 1 })).toBe("作用中遮罩：3 · 未解析：1");
    expect(translate("options.feedback.testSuccess", "zh-Hant", { count: 2 })).toBe("定位成功：2 個目標。");
  });

  it("keeps unknown interpolation variables intact", () => {
    expect(translate("popup.detail.status", "en")).toBe("Active masks: {active} · Unresolved: {unresolved}");
  });

  it("keeps product terms in English across languages", () => {
    const productTerms = ["Gmail", "Strict Mask", "Blur", "Mosaic", "URL", "locator"];
    for (const term of productTerms) {
      const zhValues = Object.values(MESSAGES["zh-Hant"]).join("\n");
      expect(zhValues).toContain(term);
    }
    expect(MESSAGES["zh-Hant"]["options.privacyMode.maximum"]).toBe("Maximum Privacy");
    expect(MESSAGES["zh-Hant"]["options.privacyMode"]).toBe("Privacy mode");
  });

  it("defaults new installs to English", () => {
    expect(DEFAULT_SETTINGS.language).toBe("en");
  });
});
