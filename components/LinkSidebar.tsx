"use client";

import { useState, useEffect, useRef } from "react";
import { ClientRecord, ManualPaymentRecord } from "@/lib/types/client";

interface SquareCustomerOption {
  id: string;
  name: string;
}

interface LinkSidebarProps {
  clients: ClientRecord[];
  squareCustomers: SquareCustomerOption[];
}

function LinkIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    exact: "bg-emerald-500",
    company: "bg-blue-500",
    fuzzy: "bg-amber-500",
    override: "bg-purple-500",
    none: "bg-gray-300",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[confidence] ?? "bg-gray-300"}`}
      title={confidence}
    />
  );
}

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function reloadDashboard() {
  await fetch("/api/revalidate", { method: "POST" });
  window.location.reload();
}

export function LinkSidebar({ clients, squareCustomers }: LinkSidebarProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Track which clients have the payment form open
  const [paymentFormOpen, setPaymentFormOpen] = useState<Record<string, boolean>>({});
  // Local form state: amount (dollars string) and start date
  const [paymentDraft, setPaymentDraft] = useState<Record<string, { amount: string; date: string }>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const filtered = clients.filter((c) =>
    search.trim() ? c.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  async function handleLink(clickupId: string, squareId: string) {
    setSaving(clickupId);
    try {
      await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickupId, squareId }),
      });
      await reloadDashboard();
    } finally {
      setSaving(null);
    }
  }

  async function handleAddPayment(client: ClientRecord) {
    const draft = paymentDraft[client.id];
    if (!draft?.amount || !draft?.date) return;
    const amountCents = Math.round(parseFloat(draft.amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;

    setSaving(client.id + "_pay");
    try {
      const existing = client.manualPayment;
      await fetch("/api/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clickupId: client.id,
          amountCents,
          nextPaymentDate: draft.date,
          active: true,
          totalCollectedCents: existing?.totalCollectedCents ?? 0,
          startDate: existing?.startDate ?? draft.date,
        }),
      });
      setPaymentFormOpen((prev) => ({ ...prev, [client.id]: false }));
      await reloadDashboard();
    } finally {
      setSaving(null);
    }
  }

  async function handleStopPayment(client: ClientRecord) {
    if (!client.manualPayment) return;
    setSaving(client.id + "_pay");
    try {
      await fetch("/api/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...client.manualPayment, clickupId: client.id, active: false }),
      });
      await reloadDashboard();
    } finally {
      setSaving(null);
    }
  }

  async function handleRestartPayment(client: ClientRecord) {
    if (!client.manualPayment) return;
    setSaving(client.id + "_pay");
    try {
      // Restarting: reset nextPaymentDate to 30 days from today
      const next = new Date();
      next.setDate(next.getDate() + 30);
      const nextDate = next.toISOString().split("T")[0];
      await fetch("/api/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...client.manualPayment,
          clickupId: client.id,
          active: true,
          nextPaymentDate: nextDate,
        }),
      });
      await reloadDashboard();
    } finally {
      setSaving(null);
    }
  }

  async function handleRemovePayment(client: ClientRecord) {
    setSaving(client.id + "_pay");
    try {
      await fetch("/api/manual-payments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickupId: client.id }),
      });
      await reloadDashboard();
    } finally {
      setSaving(null);
    }
  }

  function openPaymentForm(clientId: string, existing?: ManualPaymentRecord | null) {
    setPaymentDraft((prev) => ({
      ...prev,
      [clientId]: {
        amount: existing ? String((existing.amountCents / 100).toFixed(0)) : "",
        date: existing?.nextPaymentDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      },
    }));
    setPaymentFormOpen((prev) => ({ ...prev, [clientId]: true }));
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-brand-500 hover:text-brand-600 text-gray-500 text-sm font-medium rounded-xl transition-colors"
        title="Manually link ClickUp clients to Square customers"
      >
        <LinkIcon />
        Link Clients
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Client → Square Links</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Link clients to Square · manage manual payments
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
          {[["bg-emerald-500","Exact"],["bg-blue-500","Company"],["bg-amber-500","Fuzzy"],["bg-purple-500","Override"],["bg-gray-300","None"]].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />{label}
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map((client) => {
            const isLinkSaving = saving === client.id;
            const isPaySaving = saving === client.id + "_pay";
            const mp = client.manualPayment;
            const formOpen = paymentFormOpen[client.id];
            const draft = paymentDraft[client.id];

            return (
              <div key={client.id} className="px-6 py-4 space-y-3">
                {/* Client name row */}
                <div className="flex items-center gap-2">
                  <ConfidenceDot confidence={client.squareMatchConfidence} />
                  <span className="text-sm font-semibold text-gray-900 truncate">{client.name}</span>
                  {client.squareMatchConfidence === "override" && (
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      Override
                    </span>
                  )}
                </div>

                {/* Square link row */}
                <div className="flex items-center gap-2">
                  <select
                    value={client.squareCustomerId ?? ""}
                    onChange={(e) => handleLink(client.id, e.target.value)}
                    disabled={isLinkSaving}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-gray-700 disabled:opacity-50"
                  >
                    <option value="">— No Square customer —</option>
                    {squareCustomers.map((sq) => (
                      <option key={sq.id} value={sq.id}>
                        {sq.name}
                      </option>
                    ))}
                  </select>

                  {isLinkSaving && <Spinner />}

                  {client.squareCustomerId && !isLinkSaving && (
                    <button
                      onClick={() => handleLink(client.id, "")}
                      title="Unlink Square customer"
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>

                {client.squareCustomerName && (
                  <p className="text-xs text-gray-400 -mt-1 ml-0.5">
                    Linked: {client.squareCustomerName}
                    {client.mrr > 0 && !mp?.active && (
                      <span className="ml-2 text-purple-500 font-medium">{formatAmount(client.mrr)}/mo</span>
                    )}
                  </p>
                )}

                {/* Manual payment section */}
                <div className="border-t border-gray-50 pt-3">
                  {!mp && !formOpen && (
                    <button
                      onClick={() => openPaymentForm(client.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors"
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add manual payment
                    </button>
                  )}

                  {mp && !formOpen && (
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mp.active ? "bg-emerald-500" : "bg-gray-300"}`} />
                          <span className="font-semibold text-gray-800">{formatAmount(mp.amountCents)}/mo</span>
                          {!mp.active && <span className="text-gray-400">(stopped)</span>}
                        </div>
                        {mp.active && (
                          <div className="text-gray-400 ml-3.5">
                            Next: {formatDate(mp.nextPaymentDate)} · Collected: {formatAmount(mp.totalCollectedCents)}
                          </div>
                        )}
                        {!mp.active && mp.totalCollectedCents > 0 && (
                          <div className="text-gray-400 ml-3.5">Collected: {formatAmount(mp.totalCollectedCents)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {isPaySaving && <Spinner />}
                        {!isPaySaving && (
                          <>
                            <button
                              onClick={() => openPaymentForm(client.id, mp)}
                              title="Edit amount"
                              className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {mp.active ? (
                              <button
                                onClick={() => handleStopPayment(client)}
                                title="Stop recurring payment"
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRestartPayment(client)}
                                title="Restart recurring payment"
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleRemovePayment(client)}
                              title="Remove payment record"
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment form (add or edit) */}
                  {formOpen && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">
                        {mp ? "Edit manual payment" : "Add manual payment"}
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 block mb-1">Monthly amount ($)</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="297"
                            value={draft?.amount ?? ""}
                            onChange={(e) =>
                              setPaymentDraft((prev) => ({
                                ...prev,
                                [client.id]: { ...prev[client.id], amount: e.target.value },
                              }))
                            }
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 block mb-1">First payment date</label>
                          <input
                            type="date"
                            value={draft?.date ?? ""}
                            onChange={(e) =>
                              setPaymentDraft((prev) => ({
                                ...prev,
                                [client.id]: { ...prev[client.id], date: e.target.value },
                              }))
                            }
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleAddPayment(client)}
                          disabled={isPaySaving}
                          className="px-3 py-1.5 text-xs font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
                        >
                          {isPaySaving ? "Saving…" : mp ? "Update" : "Save"}
                        </button>
                        <button
                          onClick={() => setPaymentFormOpen((prev) => ({ ...prev, [client.id]: false }))}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Changes save instantly and refresh the dashboard
          </p>
        </div>
      </div>
    </>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin text-brand-500 flex-shrink-0" width="16" height="16" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
