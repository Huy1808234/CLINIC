/**
 * Vietnamese Full Name Formatter & Normalizer
 * Standardizes title casing, cleans extra whitespace, extracts birth year suffixes (e.g. "Nguyễn Văn A 1967"),
 * and produces unaccented normalized search keys.
 */

export interface FormattedNameResult {
  formattedName: string;
  normalizedSearchKey: string;
  extractedYear: number | null;
}

export function formatPersonName(input: string | null | undefined): FormattedNameResult {
  if (!input) {
    return { formattedName: "", normalizedSearchKey: "", extractedYear: null };
  }

  let text = input.trim();

  // Extract birth year suffix if present (e.g., " (1967)", " - 1967", " 1967")
  let extractedYear: number | null = null;
  const yearSuffixMatch = text.match(/[\s(-]+(19\d{2}|20\d{2})[)]?$/);
  if (yearSuffixMatch) {
    extractedYear = parseInt(yearSuffixMatch[1], 10);
    text = text.replace(/[\s(-]+(19\d{2}|20\d{2})[)]?$/, "").trim();
  }

  // Normalize spaces: replace multiple spaces with single space
  const words = text.split(/\s+/).filter(Boolean);

  // Capitalize first letter of each word (Title Case)
  const formattedWords = words.map((word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  const formattedName = formattedWords.join(" ");

  // Create unaccented normalized search key
  const normalizedSearchKey = removeVietnameseAccents(formattedName.toLowerCase());

  return {
    formattedName,
    normalizedSearchKey,
    extractedYear,
  };
}

export function removeVietnameseAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
