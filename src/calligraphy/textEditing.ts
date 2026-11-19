/** Apply explicit Unicode marks at the editing selection, never infer grammar. */
export function insertAtSelection(text: string, start: number, end: number, value: string) {
  const from = Math.max(0, Math.min(text.length, start));
  const to = Math.max(from, Math.min(text.length, end));
  return { text: text.slice(0, from) + value + text.slice(to), caret: from + value.length };
}

export function removeArabicMarks(text: string): string {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "");
}