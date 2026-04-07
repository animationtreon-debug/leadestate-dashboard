import { DashboardMetrics } from "@/lib/types/client";
import { formatCurrency } from "@/lib/mrr/calculate";

interface PipelineViewProps {
  metrics: DashboardMetrics;
}

export function PipelineView({ metrics }: PipelineViewProps) {
  const stages = Object.entries(metrics.pipelineStages).sort(
    (a, b) => b[1].count - a[1].count
  );

  if (!stages.length) return null;

  const maxCount = Math.max(...stages.map(([, s]) => s.count));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Pipeline Overview</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
        {stages.map(([stageName, stage]) => (
          <div
            key={stageName}
            className="flex-shrink-0 rounded-xl border-2 p-4 min-w-[150px] transition-transform hover:-translate-y-0.5"
            style={{
              borderColor: `${stage.color}40`,
              backgroundColor: `${stage.color}08`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-xs font-medium text-gray-600 capitalize truncate">
                {stageName}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stage.count}</p>
            <div
              className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(stage.count / maxCount) * 100}%`,
                  backgroundColor: stage.color,
                }}
              />
            </div>
            {stage.mrrCents > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {formatCurrency(stage.mrrCents)}/mo
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
