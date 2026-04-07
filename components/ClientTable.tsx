"use client";

import { useState, useMemo } from "react";
import { ClientRecord } from "@/lib/types/client";
import { formatCurrency } from "@/lib/mrr/calculate";
import { ClientModal } from "./ClientModal";

type SortKey = "name" | "status" | "mrr" | "totalRevenue" | "onboardingDate" | "nextPaymentDueDate" | "lastPaymentDate";

const AVATAR_COLORS = [
  "#5f55ee","#e16b16","#d33d44","#008844","#0077cc",
  "#8855cc","#cc5500","#007755","#cc3377","#445566",
];

function avatarColor(name: string, statusColor: string): string {
  // If statusColor is too light (near white), use a deterministic color from the name
  const hex = statusColor?.replace("#", "") ?? "";
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Perceived lightness — skip colors brighter than light gray
    if (r > 210 && g > 210 && b > 210) {
      const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return AVATAR_COLORS[hash % AVATAR_COLORS.length];
    }
  }
  return statusColor || AVATAR_COLORS[0];
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

function ExternalLinkSvg() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
    </svg>
  );
}

interface ClientTableProps {
  clients: ClientRecord[];
}

export function ClientTable({ clients }: ClientTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "cancelled">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = clients;

    if (filter === "active") list = list.filter((c) => c.isActive);
    else if (filter === "cancelled") list = list.filter((c) => !c.isActive);
    if (overdueOnly) list = list.filter((c) => c.invoiceStatus === "overdue");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q) ||
          (c.twilioType ?? "").toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      av = String(av);
      bv = String(bv);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [clients, search, filter, sortKey, sortAsc, overdueOnly]);

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

  return (
    <>
      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                className={`px-3 py-2 capitalize font-medium transition-colors ${
                  filter === f ? "bg-brand-500 text-white" : "text-gray-500 hover:bg-gray-50"
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
                <SortableHeader label="Status" k="status" />
                <SortableHeader label="Onboarded" k="onboardingDate" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Twilio</th>
                <SortableHeader label="MRR" k="mrr" />
                <SortableHeader label="Revenue" k="totalRevenue" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Invoice</th>
                <SortableHeader label="Next Due" k="nextPaymentDueDate" />
                <SortableHeader label="Last Payment" k="lastPaymentDate" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">
                    No clients found
                  </td>
                </tr>
              )}
              {filtered.map((client) => {
                const invoiceBadge = {
                  current: "bg-emerald-50 text-emerald-700",
                  overdue: "bg-red-50 text-red-700",
                  none: "bg-gray-50 text-gray-400",
                }[client.invoiceStatus];

                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${
                      !client.isActive ? "opacity-60" : ""
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
                        <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
                          {client.name}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                        style={{
                          backgroundColor: `${client.statusColor}18`,
                          color: client.statusColor,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: client.statusColor }} />
                        {client.status}
                      </span>
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

                    {/* MRR */}
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-semibold ${client.mrr > 0 ? "text-purple-700" : "text-gray-400"}`}>
                        {client.mrr > 0 ? formatCurrency(client.mrr) : "—"}
                      </span>
                    </td>

                    {/* Total Revenue */}
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-medium ${client.totalRevenue > 0 ? "text-gray-900" : "text-gray-400"}`}>
                        {client.totalRevenue > 0 ? formatCurrency(client.totalRevenue) : "—"}
                      </span>
                    </td>

                    {/* Invoice Status */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${invoiceBadge}`}>
                        {{
                          current: "Current",
                          overdue: "Overdue",
                          none: "—",
                        }[client.invoiceStatus]}
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
                        <ExternalLinkSvg />
                      </button>
                    </td>
                  </tr>
                );

                function ExternalLinkSvg() {
                  return (
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />
    </>
  );
}
