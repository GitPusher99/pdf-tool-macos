import i18next from "i18next";

/**
 * Translate a Rust error string in the format "error_key" or "error_key|param=value&param2=value2"
 * Falls back to the original string if no translation is found.
 */
export function translateError(errorString: string): string {
  const pipeIndex = errorString.indexOf("|");
  const key = pipeIndex === -1 ? errorString : errorString.substring(0, pipeIndex);
  const paramStr = pipeIndex === -1 ? "" : errorString.substring(pipeIndex + 1);

  const params: Record<string, string> = {};
  if (paramStr) {
    for (const pair of paramStr.split("&")) {
      const eqIndex = pair.indexOf("=");
      if (eqIndex !== -1) {
        params[pair.substring(0, eqIndex)] = pair.substring(eqIndex + 1);
      }
    }
  }

  const translated = i18next.t(`errors:${key}`, params);

  // If i18next returns the key path itself, the translation wasn't found
  if (translated === `errors:${key}` || translated === key) {
    return errorString;
  }

  return translated;
}
