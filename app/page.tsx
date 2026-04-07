import { Suspense } from "react";
import { getAllClients, computeMetrics } from "@/lib/getClients";
import { fetchAllCustomers } from "@/lib/square/fetchCustomers";
import { KPICards } from "@/components/KPICards";
import { DashboardClient } from "@/components/DashboardClient";
import { Header } from "@/components/Header";
import { LinkSidebar } from "@/components/LinkSidebar";

function SkeletonCard() {
  return <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-32 animate-pulse bg-gradient-to-br from-gray-50 to-gray-100" />;
}

async function DashboardContent() {
  const [clients, squareCustomersRaw] = await Promise.all([
    getAllClients(),
    fetchAllCustomers().catch(() => []),
  ]);
  const metrics = computeMetrics(clients);

  const squareCustomers = squareCustomersRaw.map((c) => ({
    id: c.id,
    name: [c.givenName, c.familyName].filter(Boolean).join(" ") || c.companyName || c.id,
  }));

  return (
    <>
      <Header lastSynced={metrics.lastSynced} />
      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        <KPICards metrics={metrics} />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">All Clients</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {metrics.activeClients} active · <span className="text-red-500">{metrics.cancelledClients} cancelled</span>
              </span>
              <LinkSidebar
                clients={clients}
                squareCustomers={squareCustomers}
              />
            </div>
          </div>
          <DashboardClient clients={clients} metrics={metrics} />
        </div>
      </main>
    </>
  );
}

function LoadingState() {
  return (
    <>
      <div className="bg-white border-b border-gray-100 h-[65px]" />
      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100" />
        <div className="bg-white rounded-2xl h-64 animate-pulse border border-gray-100" />
      </main>
    </>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-lg w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
        <p className="text-sm text-gray-500 mb-4">{error.message}</p>
        <p className="text-xs text-gray-400">
          Make sure your <code className="bg-gray-100 px-1.5 py-0.5 rounded">.env.local</code> file
          has valid CLICKUP_API_TOKEN, CLICKUP_LIST_ID, SQUARE_ACCESS_TOKEN, and SQUARE_LOCATION_ID.
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DashboardContentWrapper />
    </Suspense>
  );
}

async function DashboardContentWrapper() {
  try {
    return <DashboardContent />;
  } catch (err) {
    return <ErrorState error={err instanceof Error ? err : new Error(String(err))} />;
  }
}
