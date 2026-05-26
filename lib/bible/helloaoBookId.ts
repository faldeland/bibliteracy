/**
 * Map bibliteracy canonical book ids to Free Use Bible API (helloao.org)
 * three-letter USFM-style ids.
 */
const HELLOAO_BOOK_ID: Record<string, string> = {
  Joe: "JOL",
  Eze: "EZK",
  Nah: "NAM",
};

export function helloaoBookId(bookId: string): string {
  return HELLOAO_BOOK_ID[bookId] ?? bookId.toUpperCase();
}
