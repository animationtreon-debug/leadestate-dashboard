"use client";

import { ClientRecord } from "@/lib/types/client";
import { formatCurrency } from "@/lib/mrr/calculate";
import { useEffect, useRef } from "react";

interface ClientModalProps {
  client: ClientRecord | null;
  onClose: () => void;
}

function LinkButton({ href, label }: { href: string; label: string }) {
  if (!href) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
    >
      {label}
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 font-medium min-w-[160px]">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value ?? <span className="text-gray-400">—</span>}</span>
    </div>
  );
}

const INACTIVE_STATUSES = new Set(["cancelled","canceled","churned","inactive","closed","lost","terminated","complete","completed"]);

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  const isCancelled = INACTIVE_STATUSES.has(status.toLowerCase().trim());
  const displayColor = isCancelled ? "#ef4444" : color;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${displayColor}18`, color: displayColor }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: displayColor }} />
      {titleCase(status)}
    </span>
  );
}

export function ClientModal({ client, onClose }: ClientModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [client, onClose]);

  if (!client) return null;

  function contactHref(contact: string): string {
    const trimmed = contact.trim();
    if (trimmed.includes("@")) return `mailto:${trimmed}`;
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 7) return `tel:${trimmed}`;
    return "";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{client.name}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StatusBadge status={client.status} color={client.statusColor} />
              {client.twilioType && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  Twilio: {client.twilioType}
                </span>
              )}
              {client.squareMatchConfidence !== "none" && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  Square: {client.squareMatchConfidence} match
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "MRR", value: formatCurrency(client.mrr), color: "#8b5cf6" },
              { label: "Total Revenue", value: formatCurrency(client.totalRevenue), color: "#f59e0b" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: `${m.color}10` }}>
                <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* ClickUp Fields */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Client Info</h3>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 px-4">
              {client.bestWayToContact && (
                <InfoRow
                  label="Best Way to Contact"
                  value={(() => {
                    const href = contactHref(client.bestWayToContact);
                    return href ? (
                      <a href={href} className="text-blue-600 hover:text-blue-800 font-medium">
                        {client.bestWayToContact}
                      </a>
                    ) : client.bestWayToContact;
                  })()}
                />
              )}
              <InfoRow label="Onboarding Call" value={client.onboardingCall || null} />
              <InfoRow label="Onboarding Date" value={client.onboardingDate || null} />
              {client.plan && <InfoRow label="Plan" value={client.plan} />}
              <InfoRow label="Twilio Type" value={client.twilioType} />
              <InfoRow
                label="HighLevel"
                value={client.highLevelUrl ? <LinkButton href={client.highLevelUrl} label="Open HighLevel" /> : null}
              />
              <InfoRow
                label="Elite Contract"
                value={client.eliteContractUrl ? <LinkButton href={client.eliteContractUrl} label="View Contract" /> : null}
              />
              <InfoRow
                label="Client Success Sheet"
                value={client.clientSuccessSheetUrl ? <LinkButton href={client.clientSuccessSheetUrl} label="Open Sheet" /> : null}
              />
              <InfoRow
                label="Onboarding Sheet"
                value={client.onboardingSheetUrl ? <LinkButton href={client.onboardingSheetUrl} label="Open Sheet" /> : null}
              />
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Payment Details</h3>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 px-4">
              <InfoRow label="Last Payment" value={client.lastPaymentDate ? new Date(client.lastPaymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null} />
              <InfoRow label="Next Due Date" value={client.nextPaymentDueDate || null} />
              <InfoRow label="Square Customer" value={client.squareCustomerName} />
            </div>
          </div>

          {/* Active Subscriptions */}
          {client.subscriptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Subscriptions ({client.subscriptions.length})
              </h3>
              <div className="space-y-2">
                {client.subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{sub.planName || "Subscription"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {sub.cadence.toLowerCase()} · Started {sub.startDate ?? "unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(sub.mrr)}/mo</p>
                      <span
                        className={`text-xs font-medium ${
                          sub.status === "ACTIVE" ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          {client.invoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Recent Invoices ({client.invoices.length})
              </h3>
              <div className="space-y-2">
                {client.invoices.slice(0, 10).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{inv.title || "Invoice"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Due: {inv.dueDate ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</p>
                      <span
                        className={`text-xs font-medium ${
                          inv.status === "PAID"
                            ? "text-emerald-600"
                            : inv.status === "UNPAID" || inv.status === "PAYMENT_PENDING"
                            ? "text-amber-600"
                            : "text-gray-400"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
