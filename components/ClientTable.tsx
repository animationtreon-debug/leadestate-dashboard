"use client";

import { useState, useMemo } from "react";
import { ClientRecord, ManualPaymentRecord } from "@/lib/types/client";
import { formatCurrency } from "@/lib/mrr/calculate";
import { ClientModal } from "./ClientModal";

type SortKey = "stage" | "name" | "status" | "mrr" | "totalRevenue" | "onboardingDate" | "nextPaymentDueDate" | "lastPaymentDate";

const STAGE_PRIORITY: Record<string, number> = {
  "open": 1,
  "first app show": 2,
  "appointment book": 3,
  "first cc": 4,
  "work to do": 5,
  "review": 6,
  "management": 7,
};
function stagePriority(status: string): number {
  return STAGE_PRIORITY[status.toLowerCase().trim()] ?? 99;
}

function contactHref(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return `mailto:${trimmed}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7) return `tel:${trimmed}`;
  return "";
}

const AVATAR_COLORS = [
  "#5f55ee","#e16b16","#d33d44","#008844","#0077cc",
  "#8855cc","#cc5500","#007755","#cc3377","#445566",
];

const INACTIVE_STATUSES = new Set([
  "cancelled","canceled","churned","inactive","closed","lost","terminated","complete","completed",
]);

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function avatarColor(name: string, statusColor: string): string {
  const hex = statusColor?.replace("#", "") ?? "";
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (r > 210 && g > 210 && b > 210) {
      const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return AVATAR_COLORS[hash % AVATAR_COLORS.length];
    }
  }
  return statusColor || AVATAR_COLORS[0];
}

function formatWithCurrency(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return formatCurrency(cents);
  }
}

function cycleSuffix(cycle: "monthly" | "yearly" | "one_time"): string {
  if (cycle === "yearly") return "/yr";
  if (cycle === "one_time") return " one-time";
  return "/mo";
}

function LinkIcon({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
    >
      {children}
    </a>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin text-blue-500 inline-block" width="14" height="14" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "SGD"];

interface InlinePaymentDraft {
  amount: string;
  currency: string;
  billingCycle: "monthly" | "yearly" | "one_time";
}

interface ClientTableProps {
  clients: ClientRecord[];
  stageFilter?: string | null;
}

export function ClientTable({ clients, stageFilter }: ClientTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("all");
  const [sortKey, setSortKey] = useState<SortKey>("stage");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Inline payment editing state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<InlinePaymentDraft>({ amount: "", currency: "USD", billingCycle: "monthly" });
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = clients;

    // Stage filter from pipeline click
    if (stageFilter) list = list.filter((c) => c.status.toLowerCase() === stageFilter.toLowerCase());

    if (filter === "active") list = list.filter((c) => c.isActive);
    else if (filter === "cancelled") list = list.filter((c) => !c.isActive);
    if (overdueOnly) list = list.filter((c) => c.invoiceStatus === "overdue");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q) ||
          (c.twilioType ?? "").toLowerCase().includes(q) ||
          (c.plan ?? "").toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (sortKey === "stage") {
        const pa = stagePriority(a.status), pb = stagePriority(b.status);
        if (pa !== pb) return sortAsc ? pa - pb : pb - pa;
        return a.name.localeCompare(b.name);
      }
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      av = String(av);
      bv = String(bv);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [clients, search, filter, sortKey, sortAsc, overdueOnly, stageFilter]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortableHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap select-none"
        onClick={() => handleSort(k)}
      >
        <div className="flex items-center gap-1.5">
          {label}
          {sortKey === k ? (
            <ChevronIcon up={sortAsc} />
          ) : (
            <span className="opacity-30"><ChevronIcon up={true} /></span>
          )}
        </div>
      </th>
    );
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  function openPaymentEdit(client: ClientRecord, e: React.MouseEvent) {
    e.stopPropagation();
    if (editingPaymentId === client.id) {
      setEditingPaymentId(null);
      return;
    }
    const mp = client.manualPayment;
    setPaymentDraft({
      amount: mp ? String((mp.amountCents / 100).toFixed(0)) : "",
      currency: mp?.currency ?? "USD",
      billingCycle: mp?.billingCycle ?? "monthly",
    });
    setEditingPaymentId(client.id);
  }

  async function savePayment(client: ClientRecord) {
    const amount = parseFloat(paymentDraft.amount);
    if (isNaN(amount) || amount <= 0) return;
    const amountCents = Math.round(amount * 100);
    const existing = client.manualPayment;

    setSavingPaymentId(client.id);
    try {
      const nextDate = existing?.nextPaymentDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      await fetch("/api/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clickupId: client.id,
          amountCents,
          nextPaymentDate: nextDate,
          active: existing?.active ?? true,
          totalCollectedCents: existing?.totalCollectedCents ?? 0,
          startDate: existing?.startDate ?? nextDate,
          currency: paymentDraft.currency,
          billingCycle: paymentDraft.billingCycle,
        }),
      });
      await fetch("/api/revalidate", { method: "POST" });
      setEditingPaymentId(null);
      window.location.reload();
    } finally {
      setSavingPaymentId(null);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Stage filter banner */}
        {stageFilter && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-medium flex items-center gap-2">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filtered by pipeline stage: <span className="font-bold">{titleCase(stageFilter)}</span>
            <span className="text-blue-400 ml-1">— click the stage card again to clear</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-gray-50"
            />
          </div>

          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
            {(["all", "active", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 font-medium transition-colors capitalize ${
                  filter === f
                    ? f === "cancelled" ? "bg-red-500 text-white" : "bg-brand-500 text-white"
                    : f === "cancelled" ? "text-red-500 hover:bg-red-50" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOverdueOnly((v) => !v)}
            className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
              overdueOnly ? "bg-red-500 text-white border-red-500" : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Overdue only
          </button>

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} client{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <SortableHeader label="Client" k="name" />
                <SortableHeader label="Stage" k="stage" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Plan</th>
                <SortableHeader label="Onboarded" k="onboardingDate" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Twilio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Onboarding Call</th>
                <SortableHeader label="MRR" k="mrr" />
                <SortableHeader label="Revenue" k="totalRevenue" />
                <SortableHeader label="Next Due" k="nextPaymentDueDate" />
                <SortableHeader label="Last Payment" k="lastPaymentDate" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-sm text-gray-400">
                    No clients found
                  </td>
                </tr>
              )}
              {filtered.map((client) => {
                const isCancelled = INACTIVE_STATUSES.has(client.status.toLowerCase().trim());
                const statusDisplayColor = isCancelled ? "#ef4444" : client.statusColor;
                const isEditingPayment = editingPaymentId === client.id;
                const isSavingPayment = savingPaymentId === client.id;
                const mp = client.manualPayment;

                const contactHrefValue = client.bestWayToContact ? contactHref(client.bestWayToContact) : "";

                return (
                  <>
                    <tr
                      key={client.id}
                      className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${
                        !client.isActive ? "opacity-70" : ""
                      }`}
                      onClick={() => setSelectedClient(client)}
                    >
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: avatarColor(client.name, client.statusColor) }}
                          >
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-sm font-semibold truncate max-w-[200px] ${isCancelled ? "text-red-700" : "text-gray-900"}`}>
                            {client.name}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                          style={{
                            backgroundColor: `${statusDisplayColor}18`,
                            color: statusDisplayColor,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusDisplayColor }} />
                          {titleCase(client.status)}
                        </span>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3.5">
                        {client.plan ? (
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
                            {client.plan}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Onboarding Date */}
                      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {client.onboardingDate ?? "—"}
                      </td>

                      {/* Twilio Type */}
                      <td className="px-4 py-3.5">
                        {client.twilioType ? (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                            {client.twilioType}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {client.bestWayToContact ? (
                          contactHrefValue ? (
                            <a
                              href={contactHrefValue}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
                              title={client.bestWayToContact}
                            >
                              {contactHrefValue.startsWith("mailto:") ? (
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                  <polyline points="22,6 12,13 2,6" />
                                </svg>
                              ) : (
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.93 2 2 0 0 1 3.6 2.73h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.5A16 16 0 0 0 13.5 16.09l.97-.97a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7a2 2 0 0 1 1.61 2.05z" />
                                </svg>
                              )}
                              <span className="truncate max-w-[120px]">{client.bestWayToContact}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600 truncate max-w-[120px] block">{client.bestWayToContact}</span>
                          )
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Onboarding Call */}
                      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {client.onboardingCall ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* MRR */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 group">
                          <span className={`text-sm font-semibold ${client.mrr > 0 ? "text-purple-700" : "text-gray-400"}`}>
                            {client.mrr > 0
                              ? `${formatWithCurrency(client.mrr, mp?.billingCycle === "yearly" ? mp?.currency : "USD")}${mp && !client.subscriptions.length ? cycleSuffix(mp.billingCycle) : "/mo"}`
                              : "—"}
                          </span>
                          <button
                            onClick={(e) => openPaymentEdit(client, e)}
                            title={mp ? "Edit manual payment" : "Add manual payment"}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-purple-100 text-purple-400 hover:text-purple-600 flex-shrink-0 ${isEditingPayment ? "opacity-100 bg-purple-100 text-purple-600" : ""}`}
                          >
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      </td>

                      {/* Total Revenue */}
                      <td className="px-4 py-3.5">
                        <span className={`text-sm font-medium ${client.totalRevenue > 0 ? "text-gray-900" : "text-gray-400"}`}>
                          {client.totalRevenue > 0 ? formatWithCurrency(client.totalRevenue, mp?.currency) : "—"}
                        </span>
                      </td>

                      {/* Next Due */}
                      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {client.nextPaymentDueDate ?? "—"}
                      </td>

                      {/* Last Payment */}
                      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(client.lastPaymentDate)}
                      </td>

                      {/* Links */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {client.highLevelUrl && (
                            <LinkIcon href={client.highLevelUrl} title="HighLevel">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                            </LinkIcon>
                          )}
                          {client.eliteContractUrl && (
                            <LinkIcon href={client.eliteContractUrl} title="Elite Contract">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                            </LinkIcon>
                          )}
                          {client.clientSuccessSheetUrl && (
                            <LinkIcon href={client.clientSuccessSheetUrl} title="Client Success Sheet">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                              </svg>
                            </LinkIcon>
                          )}
                          {client.onboardingSheetUrl && (
                            <LinkIcon href={client.onboardingSheetUrl} title="Onboarding Sheet">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 11l3 3L22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                              </svg>
                            </LinkIcon>
                          )}
                          {!client.highLevelUrl && !client.eliteContractUrl && !client.clientSuccessSheetUrl && !client.onboardingSheetUrl && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Detail Button */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* Inline payment edit row */}
                    {isEditingPayment && (
                      <tr key={`${client.id}-pay`} className="bg-purple-50/60 border-l-4 border-purple-400">
                        <td colSpan={13} className="px-6 py-3">
                          <div className="flex items-end gap-3 flex-wrap">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1 font-medium">Amount</label>
                              <input
                                type="number"
                                min="1"
                                placeholder="297"
                                value={paymentDraft.amount}
                                onChange={(e) => setPaymentDraft((p) => ({ ...p, amount: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                                className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1 font-medium">Currency</label>
                              <select
                                value={paymentDraft.currency}
                                onChange={(e) => setPaymentDraft((p) => ({ ...p, currency: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                              >
                                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1 font-medium">Billing Cycle</label>
                              <select
                                value={paymentDraft.billingCycle}
                                onChange={(e) => setPaymentDraft((p) => ({ ...p, billingCycle: e.target.value as "monthly" | "yearly" | "one_time" }))}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                              >
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                                <option value="one_time">One Time</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); savePayment(client); }}
                                disabled={isSavingPayment}
                                className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                              >
                                {isSavingPayment ? <Spinner /> : mp ? "Update" : "Save"}
                              </button>
                              {mp && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setSavingPaymentId(client.id);
                                    await fetch("/api/manual-payments", {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ clickupId: client.id }),
                                    });
                                    await fetch("/api/revalidate", { method: "POST" });
                                    setEditingPaymentId(null);
                                    window.location.reload();
                                  }}
                                  disabled={isSavingPayment}
                                  className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingPaymentId(null); }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                            {mp && (
                              <span className="text-xs text-gray-400 ml-2">
                                Currently: {formatWithCurrency(mp.amountCents, mp.currency)}{cycleSuffix(mp.billingCycle)} · Collected: {formatWithCurrency(mp.totalCollectedCents, mp.currency)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />
    </>
  );
}
