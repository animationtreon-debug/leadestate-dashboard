import { RawSquareCustomer } from "../square/fetchCustomers";
import { storageGet } from "../storage";

async function loadOverrides(): Promise<Record<string, string>> {
  return (await storageGet<Record<string, string>>("match-overrides")) ?? {};
}

// Suffixes appended to client names in ClickUp that don't appear in Square
// e.g. "John Chau - Echosetter" → base name "John Chau"
const STRIP_SUFFIXES = [
  /\s*-\s*(echosetter|elite|mortgage broker|real estate agent|uk client|core leadership|personal|refund dispute).*$/i,
  /\s*\[.*?\]/g,   // strip [Elite], [Echosetter Client] etc.
  /\s*\(.*?\)/g,   // strip (Personal) etc.
];

function baseName(raw: string): string {
  let s = raw;
  for (const pattern of STRIP_SUFFIXES) {
    s = s.replace(pattern, "");
  }
  return s.trim();
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

// Check if a ClickUp base name's first token (first name) appears in the Square name,
// and vice-versa — handles "Sam Ko" vs "Samuel Ko", "Steve Sia" vs "Steven Sia"
function firstNameScore(clickupBase: string, squareName: string): number {
  const ctokens = tokens(clickupBase);
  const stokens = tokens(squareName);
  if (!ctokens.length || !stokens.length) return 0;

  // Exact first-name match
  if (ctokens[0] === stokens[0]) return 0.65;

  // Prefix match: "sam" starts "samuel" or vice-versa
  const a = ctokens[0], b = stokens[0];
  if (a.startsWith(b) || b.startsWith(a)) return 0.55;

  return 0;
}

export type MatchResult = {
  squareCustomerId: string;
  squareCustomerName: string;
  confidence: "exact" | "company" | "fuzzy" | "override" | "none";
};

export async function matchClientsToSquare(
  clickupTasks: Array<{ id: string; name: string }>,
  squareCustomers: RawSquareCustomer[]
): Promise<Map<string, MatchResult>> {
  const MATCH_OVERRIDES = await loadOverrides();
  const resultMap = new Map<string, MatchResult>();

  for (const task of clickupTasks) {
    // Pass 0: Manual override (from file)
    if (task.id in MATCH_OVERRIDES) {
      const customerId = MATCH_OVERRIDES[task.id];
      // "__none__" sentinel = user explicitly unlinked; skip all auto-matching
      if (customerId === "__none__" || customerId === "") {
        resultMap.set(task.id, { squareCustomerId: "", squareCustomerName: "", confidence: "none" });
        continue;
      }
      const customer = squareCustomers.find((c) => c.id === customerId);
      const name =
        [customer?.givenName, customer?.familyName].filter(Boolean).join(" ") ||
        customer?.companyName ||
        customerId;
      resultMap.set(task.id, { squareCustomerId: customerId, squareCustomerName: name, confidence: "override" });
      continue;
    }

    const base = baseName(task.name);
    const normalizedTask = normalize(task.name);
    const normalizedBase = normalize(base);

    let bestMatch: MatchResult | null = null;
    let bestScore = 0;
    let foundExact = false;

    for (const customer of squareCustomers) {
      const fullName = [customer.givenName, customer.familyName].filter(Boolean).join(" ");
      const companyName = customer.companyName ?? "";
      const normalizedFull = normalize(fullName);
      const normalizedCompany = normalize(companyName);

      // Pass 1: Exact full-name match (raw task name or stripped base name)
      if (normalizedTask === normalizedFull || normalizedBase === normalizedFull) {
        resultMap.set(task.id, {
          squareCustomerId: customer.id,
          squareCustomerName: fullName || companyName,
          confidence: "exact",
        });
        foundExact = true;
        break;
      }

      // Pass 2: Exact company name match
      if (companyName && (normalizedTask === normalizedCompany || normalizedBase === normalizedCompany)) {
        if (1.0 > bestScore) {
          bestScore = 1.0;
          bestMatch = { squareCustomerId: customer.id, squareCustomerName: companyName, confidence: "company" };
        }
        continue;
      }

      // Pass 3: Jaccard on base name (lowered threshold to 0.4 for partial names)
      const jBase = jaccardSimilarity(base, fullName);
      const jFull = jaccardSimilarity(task.name, fullName);
      const jCompany = companyName ? jaccardSimilarity(base, companyName) : 0;
      let score = Math.max(jBase, jFull, jCompany);

      // Pass 4: First-name / prefix boost — e.g. "Sam Ko" ↔ "Samuel Ko"
      const fnScore = firstNameScore(base, fullName);
      if (fnScore > 0) {
        // Combine: if last name token also matches, boost further
        const ctokens = tokens(base);
        const stokens = tokens(fullName);
        const lastTokenMatch =
          ctokens.length > 1 && stokens.length > 1 && ctokens[ctokens.length - 1] === stokens[stokens.length - 1];
        score = Math.max(score, lastTokenMatch ? fnScore + 0.25 : fnScore);
      }

      if (score >= 0.4 && score > bestScore) {
        bestScore = score;
        const useName = (score === jCompany && companyName) ? companyName : fullName;
        bestMatch = {
          squareCustomerId: customer.id,
          squareCustomerName: useName || companyName,
          confidence: "fuzzy",
        };
      }
    }

    if (!foundExact) {
      if (bestMatch) {
        resultMap.set(task.id, bestMatch);
      } else {
        resultMap.set(task.id, { squareCustomerId: "", squareCustomerName: "", confidence: "none" });
      }
    }
  }

  return resultMap;
}
