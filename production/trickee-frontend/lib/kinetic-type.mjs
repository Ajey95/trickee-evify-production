export function tokenizeKineticText(value) {
  const label = String(value ?? "").trim().replace(/\s+/g, " ");
  let charIndex = 0;

  const words = label === "" ? [] : label.split(" ").map((text, wordIndex) => ({
    text,
    wordIndex,
    chars: Array.from(text, (char) => ({
      text: char,
      charIndex: charIndex++,
    })),
  }));

  return { label, characterCount: charIndex, words };
}
