// Locates section page-ranges by header-text search rather than hardcoded
// page numbers — page counts vary per patient/report (especially the PGx
// drug-table section, whose length depends on how many drug classes have
// findings), so a fixed page-number map would silently break on a
// differently-shaped report.
export function firstLines(linesByPage: string[][]): string[] {
  return linesByPage.map((lines) => lines.find((l) => l.trim()) ?? "");
}

// Returns the contiguous run of 1-indexed page numbers whose first line
// matches `re`, starting at the first match after `after` (1-indexed,
// exclusive) if given.
export function findPageRun(lines: string[], re: RegExp, after = 0): number[] {
  const pages: number[] = [];
  let started = false;
  for (let i = after; i < lines.length; i++) {
    const pageNum = i + 1;
    if (re.test(lines[i])) {
      pages.push(pageNum);
      started = true;
    } else if (started) {
      break;
    }
  }
  return pages;
}

export function findFirstPage(lines: string[], re: RegExp, after = 0): number | null {
  for (let i = after; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  return null;
}
