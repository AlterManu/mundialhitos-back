export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’`´]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function compactName(value: string | null | undefined): string {
  return normalizeName(value).replace(/\s+/g, "");
}

export function splitPersonName(rawName: string): {
  name: string | null;
  lastname: string | null;
} {
  const parts = rawName
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) {
    return { name: null, lastname: null };
  }

  if (parts.length === 1) {
    return { name: null, lastname: parts[0] ?? null };
  }

  const lastname = parts[parts.length - 1] ?? null;
  const name = parts.slice(0, -1).join(" ") || null;
  return { name, lastname };
}

export function initialsAndLastname(firstName: string | null, lastname: string | null) {
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastname = normalizeName(lastname);
  if (!normalizedFirstName || !normalizedLastname) return null;

  return `${normalizedFirstName[0]} ${normalizedLastname}`;
}

export function teamCodeFromName(teamName: string): string {
  const words = normalizeName(teamName).split(" ").filter(Boolean);
  const code =
    words.length >= 3
      ? words.slice(0, 3).map((word) => word[0]).join("")
      : words.join("").slice(0, 3);

  return (code || "UNK").toUpperCase().padEnd(3, "X").slice(0, 3);
}
