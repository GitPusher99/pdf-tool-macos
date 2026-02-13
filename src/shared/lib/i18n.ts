import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { getSystemLocale } from "./commands";

declare const __APP_LOCALE__: string;

import zhCommon from "../locales/zh-CN/common.json";
import zhLibrary from "../locales/zh-CN/library.json";
import zhReader from "../locales/zh-CN/reader.json";
import zhErrors from "../locales/zh-CN/errors.json";

import enCommon from "../locales/en/common.json";
import enLibrary from "../locales/en/library.json";
import enReader from "../locales/en/reader.json";
import enErrors from "../locales/en/errors.json";

import jaCommon from "../locales/ja/common.json";
import jaLibrary from "../locales/ja/library.json";
import jaReader from "../locales/ja/reader.json";
import jaErrors from "../locales/ja/errors.json";

import koCommon from "../locales/ko/common.json";
import koLibrary from "../locales/ko/library.json";
import koReader from "../locales/ko/reader.json";
import koErrors from "../locales/ko/errors.json";

import zhTWCommon from "../locales/zh-TW/common.json";
import zhTWLibrary from "../locales/zh-TW/library.json";
import zhTWReader from "../locales/zh-TW/reader.json";
import zhTWErrors from "../locales/zh-TW/errors.json";

import frCommon from "../locales/fr/common.json";
import frLibrary from "../locales/fr/library.json";
import frReader from "../locales/fr/reader.json";
import frErrors from "../locales/fr/errors.json";

import deCommon from "../locales/de/common.json";
import deLibrary from "../locales/de/library.json";
import deReader from "../locales/de/reader.json";
import deErrors from "../locales/de/errors.json";

import esCommon from "../locales/es/common.json";
import esLibrary from "../locales/es/library.json";
import esReader from "../locales/es/reader.json";
import esErrors from "../locales/es/errors.json";

import ptCommon from "../locales/pt/common.json";
import ptLibrary from "../locales/pt/library.json";
import ptReader from "../locales/pt/reader.json";
import ptErrors from "../locales/pt/errors.json";

import ruCommon from "../locales/ru/common.json";
import ruLibrary from "../locales/ru/library.json";
import ruReader from "../locales/ru/reader.json";
import ruErrors from "../locales/ru/errors.json";

import itCommon from "../locales/it/common.json";
import itLibrary from "../locales/it/library.json";
import itReader from "../locales/it/reader.json";
import itErrors from "../locales/it/errors.json";

function resolveLanguage(locale: string): string {
  const lower = locale.toLowerCase();
  if (lower.startsWith("zh")) {
    if (lower.includes("tw") || lower.includes("hk") || lower.includes("hant")) return "zh-TW";
    return "zh-CN";
  }
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("pt")) return "pt";
  if (lower.startsWith("ru")) return "ru";
  if (lower.startsWith("it")) return "it";
  return "en";
}

export async function initI18n() {
  let locale = __APP_LOCALE__;
  if (!locale) {
    try {
      locale = await getSystemLocale();
    } catch {
      locale = "en";
    }
  }

  const lng = resolveLanguage(locale);

  await i18next.use(initReactI18next).init({
    lng,
    fallbackLng: "en",
    ns: ["common", "library", "reader", "errors"],
    defaultNS: "common",
    resources: {
      "zh-CN": {
        common: zhCommon,
        library: zhLibrary,
        reader: zhReader,
        errors: zhErrors,
      },
      en: {
        common: enCommon,
        library: enLibrary,
        reader: enReader,
        errors: enErrors,
      },
      ja: {
        common: jaCommon,
        library: jaLibrary,
        reader: jaReader,
        errors: jaErrors,
      },
      ko: {
        common: koCommon,
        library: koLibrary,
        reader: koReader,
        errors: koErrors,
      },
      "zh-TW": {
        common: zhTWCommon,
        library: zhTWLibrary,
        reader: zhTWReader,
        errors: zhTWErrors,
      },
      fr: {
        common: frCommon,
        library: frLibrary,
        reader: frReader,
        errors: frErrors,
      },
      de: {
        common: deCommon,
        library: deLibrary,
        reader: deReader,
        errors: deErrors,
      },
      es: {
        common: esCommon,
        library: esLibrary,
        reader: esReader,
        errors: esErrors,
      },
      pt: {
        common: ptCommon,
        library: ptLibrary,
        reader: ptReader,
        errors: ptErrors,
      },
      ru: {
        common: ruCommon,
        library: ruLibrary,
        reader: ruReader,
        errors: ruErrors,
      },
      it: {
        common: itCommon,
        library: itLibrary,
        reader: itReader,
        errors: itErrors,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

  document.documentElement.lang = lng;
}
