const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

/** "DIANA GARCÍA DE LA CRUZ" -> "Diana García de la Cruz" */
export function toTitleCase(text: string): string {
      return text
            .trim()
            .toLocaleLowerCase("es")
            .split(/\s+/)
            .map((word, i) =>
                  i > 0 && LOWERCASE_WORDS.has(word)
                        ? word
                        : word.charAt(0).toLocaleUpperCase("es") + word.slice(1)
            )
            .join(" ");
}
