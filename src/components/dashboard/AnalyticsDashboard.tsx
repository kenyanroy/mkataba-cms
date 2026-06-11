"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SummaryData {
  totalContractValue: number;
  statusDistribution: Array<{ status: string; count: number }>;
  expiringIn30Days: number;
  expiringIn90Days: number;
  overdueApprovals: number;
  signingCompletionRate: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  UNDER_REVIEW: "#3b82f6",
  PENDING_APPROVAL: "#f59e0b",
  APPROVED: "#22c55e",
  PENDING_SIGNATURE: "#a855f7",
  EXECUTED: "#10b981",
  ARCHIVED: "#6b7280",
  REJECTED: "#ef4444",
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "warning" | "success";
}

function KPICard({ title, value, subtitle, icon: Icon, variant = "default" }: KPICardProps) {
  const colors = {
    default: "text-primary",
    warning: "text-amber-600",
    success: "text-emerald-600",
  };
  return (
    <div className="rounded-lg border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${colors[variant]}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-md bg-muted ${colors[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ data }: { data: SummaryData }) {
  const totalContracts = data.statusDistribution.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* KPI Grid — 1 col mobile, 2 col tablet, 4 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Contract Value"
          value={`KES ${(data.totalContractValue / 1_000_000).toFixed(1)}M`}
          subtitle="Executed contracts"
          icon={TrendingUp}
          variant="success"
        />
        <KPICard
          title="Total Contracts"
          value={totalContracts}
          subtitle="Across all statuses"
          icon={FileText}
        />
        <KPICard
          title="Expiring in 30 Days"
          value={data.expiringIn30Days}
          subtitle={`${data.expiringIn90Days} within 90 days`}
          icon={AlertTriangle}
          variant={data.expiringIn30Days > 0 ? "warning" : "default"}
        />
        <KPICard
          title="Signing Completion"
          value={`${data.signingCompletionRate}%`}
          subtitle="Submitted → executed"
          icon={CheckCircle2}
          variant={data.signingCompletionRate >= 80 ? "success" : "default"}
        />
      </div>

      {/* Charts — stack on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Donut */}
        <div className="rounded-lg border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-4">Contract Status Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.statusDistribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
              >
                {data.statusDistribution.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? "#94a3b8"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name.toString().replace(/_/g, " ")]}
              />
              <Legend
                formatter={(value) => value.replace(/_/g, " ")}
                wrapperStyle={{ fontSize: "11px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Expiry Timeline Bar Chart */}
        <div className="rounded-lg border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-4">Upcoming Expirations</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[
                { period: "0-30 days", count: data.expiringIn30Days },
                {
                  period: "31-90 days",
                  count: data.expiringIn90Days - data.expiringIn30Days,
                },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Contracts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Overdue approvals alert */}
      {data.overdueApprovals > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {data.overdueApprovals} overdue approval{data.overdueApprovals !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These approval tokens have expired. Reassign or re-send to unblock contracts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
