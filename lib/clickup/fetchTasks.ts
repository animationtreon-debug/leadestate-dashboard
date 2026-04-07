import { clickupFetch } from "./client";

// Map of canonical field names to possible ClickUp custom field names (case-insensitive)
const FIELD_NAMES: Record<string, string[]> = {
  clientSuccessSheet: ["client success sheet", "client success", "success sheet"],
  eliteContract: ["elite contract", "elite contract link", "contract link", "contract"],
  highLevel: ["highlevel", "high level", "highlevel link", "high level link"],
  onboardingDate: ["onboarding date", "onboard date", "start date"],
  onboardingSheet: [
    "onboarding sheet",
    "access sheet",
    "onboarding sheet / access sheet",
    "onboarding / access sheet",
    "onboarding access sheet",
  ],
  twilioType: ["twilio type", "twilio", "twilio account type"],
};

function matchFieldName(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [key, variants] of Object.entries(FIELD_NAMES)) {
    if (variants.some((v) => lower === v || lower.includes(v) || v.includes(lower))) {
      return key;
    }
  }
  return null;
}

function extractCustomFieldValue(field: {
  name: string;
  type: string;
  value?: unknown;
}): string | null {
  if (field.value === null || field.value === undefined) return null;

  // Date fields come as Unix ms timestamps
  if (field.type === "date" && typeof field.value === "string") {
    const ts = parseInt(field.value);
    if (!isNaN(ts)) {
      return new Date(ts).toISOString().split("T")[0];
    }
  }

  // URL fields
  if (field.type === "url" && typeof field.value === "string") {
    return field.value;
  }

  // Short text, text fields
  if (typeof field.value === "string") return field.value || null;

  // Drop-down fields: value is the selected option index, type_config has options
  if (field.type === "drop_down" && typeof field.value === "number") {
    const cf = field as {
      type_config?: { options?: Array<{ orderindex: number; name: string }> };
    } & typeof field;
    const options = cf.type_config?.options ?? [];
    const opt = options.find((o) => o.orderindex === field.value);
    return opt?.name ?? null;
  }

  return null;
}

export interface RawClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
    type: string;
  };
  custom_fields: Array<{
    id: string;
    name: string;
    type: string;
    type_config?: unknown;
    value?: unknown;
  }>;
  date_updated: string;
}

export interface ParsedTask {
  id: string;
  name: string;
  status: { status: string; color: string; type: string };
  onboardingDate: string | null;
  clientSuccessSheetUrl: string | null;
  eliteContractUrl: string | null;
  highLevelUrl: string | null;
  onboardingSheetUrl: string | null;
  twilioType: string | null;
}

function parseTask(raw: RawClickUpTask): ParsedTask {
  const fields: Record<string, string | null> = {};

  for (const cf of raw.custom_fields) {
    const key = matchFieldName(cf.name);
    if (key) {
      fields[key] = extractCustomFieldValue({
        name: cf.name,
        type: cf.type,
        value: cf.value,
        ...cf,
      } as Parameters<typeof extractCustomFieldValue>[0]);
    }
  }

  return {
    id: raw.id,
    name: raw.name.trim(),
    status: raw.status,
    onboardingDate: fields.onboardingDate ?? null,
    clientSuccessSheetUrl: fields.clientSuccessSheet ?? null,
    eliteContractUrl: fields.eliteContract ?? null,
    highLevelUrl: fields.highLevel ?? null,
    onboardingSheetUrl: fields.onboardingSheet ?? null,
    twilioType: fields.twilioType ?? null,
  };
}

export async function fetchAllTasks(): Promise<ParsedTask[]> {
  const listId = process.env.CLICKUP_LIST_ID;
  if (!listId) throw new Error("CLICKUP_LIST_ID is not set");

  const allTasks: ParsedTask[] = [];
  let page = 0;

  while (true) {
    const params = new URLSearchParams({
      include_closed: "true",
      subtasks: "false",
      page: String(page),
    });

    const data = (await clickupFetch(`/list/${listId}/task?${params}`, {
      next: { tags: ["clickup-tasks"], revalidate: 300 },
    } as RequestInit)) as { tasks: RawClickUpTask[] };

    const tasks = data.tasks ?? [];
    allTasks.push(...tasks.map(parseTask));

    if (tasks.length < 100) break;
    page++;
  }

  return allTasks;
}
