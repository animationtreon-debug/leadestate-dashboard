import { DashboardMetrics } from "@/lib/types/client";
import { formatCurrency } from "@/lib/mrr/calculate";

interface PipelineViewProps {
  metrics: DashboardMetrics;
  activeStage?: string | null;
  onStageClick?: (stage: string | null) => void;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "churned", "inactive", "closed", "lost", "terminated", "complete", "completed"]);

export function PipelineView({ metrics, activeStage, onStageClick }: PipelineViewProps) {
  const stages = Object.entries(metrics.pipelineStages).sort(
    (a, b) => b[1].count - a[1].count
  );

  if (!stages.length) return null;

  const maxCount = Math.max(...stages.map(([, s]) => s.count));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">Pipeline Overview</h2>
        {activeStage && onStageClick && (
          <button
            onClick={() => onStageClick(null)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear filter
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
        {stages.map(([stageName, stage]) => {
          const isCancelled = CANCELLED_STATUSES.has(stageName.toLowerCase());
          const stageColor = isCancelled ? "#ef4444" : stage.color;
          const isActive = activeStage === stageName;

          return (
            <div
              key={stageName}
              onClick={() => onStageClick?.(isActive ? null : stageName)}
              className={`flex-shrink-0 rounded-xl border-2 p-4 min-w-[150px] transition-all ${
                onStageClick ? "cursor-pointer hover:-translate-y-0.5" : ""
              } ${isActive ? "ring-2 ring-offset-1 shadow-md" : ""}`}
              style={{
                borderColor: isActive ? stageColor : `${stageColor}40`,
                backgroundColor: isActive ? `${stageColor}14` : `${stageColor}08`,
                ringColor: stageColor,
              } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stageColor }}
                />
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: isCancelled ? "#ef4444" : "#4b5563" }}
                >
                  {titleCase(stageName)}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stage.count}</p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(stage.count / maxCount) * 100}%`,
                    backgroundColor: stageColor,
                  }}
                />
              </div>
              {stage.mrrCents > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {formatCurrency(stage.mrrCents)}/mo
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
