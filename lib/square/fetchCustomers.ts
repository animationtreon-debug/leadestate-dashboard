import { getSquareClient } from "./client";

export interface RawSquareCustomer {
  id: string;
  givenName: string | null;
  familyName: string | null;
  companyName: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  createdAt: string | null;
}

export async function fetchAllCustomers(): Promise<RawSquareCustomer[]> {
  const client = getSquareClient();
  const all: RawSquareCustomer[] = [];

  let page = await client.customers.list({});
  all.push(...page.data.map(normalizeCustomer));
  while (page._hasNextPage()) {
    page = await page.loadNextPage();
    all.push(...page.data.map(normalizeCustomer));
  }

  return all;
}

function normalizeCustomer(c: {
  id?: string;
  givenName?: string;
  familyName?: string;
  companyName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  createdAt?: string;
}): RawSquareCustomer {
  return {
    id: c.id ?? "",
    givenName: c.givenName ?? null,
    familyName: c.familyName ?? null,
    companyName: c.companyName ?? null,
    emailAddress: c.emailAddress ?? null,
    phoneNumber: c.phoneNumber ?? null,
    createdAt: c.createdAt ?? null,
  };
}
