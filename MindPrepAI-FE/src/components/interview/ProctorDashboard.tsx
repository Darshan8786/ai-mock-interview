import { motion } from "framer-motion";
import type { ProctorEvent } from "../../types/proctor";

interface ProctorDashboardProps {
  events: ProctorEvent[];
}

export function ProctorDashboard({ events }: ProctorDashboardProps) {
  const violations = events.filter((e) => e.severity === "violation");
  const warnings = events.filter((e) => e.severity === "warning");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 space-y-6"
    >
      <h2 className="text-lg font-bold text-white">Proctoring Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox label="Total Violations" value={violations.length} color="text-red-400" />
        <MetricBox label="Warnings" value={warnings.length} color="text-yellow-400" />
        <MetricBox label="Integrity Score" value={`${Math.max(0, 100 - violations.length * 20)}%`} color="text-emerald-400" />
        <MetricBox label="Events Logged" value={events.length} color="text-blue-400" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Events</h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No proctoring events recorded</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {events.slice(-20).reverse().map((event, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-2 rounded-lg text-xs ${
                  event.severity === "violation"
                    ? "bg-red-500/10"
                    : event.severity === "warning"
                    ? "bg-yellow-500/10"
                    : "bg-gray-700/30"
                }`}
              >
                <span className="mt-0.5">
                  {event.severity === "violation" ? "🔴" : event.severity === "warning" ? "🟡" : "🟢"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 font-medium">{event.description}</p>
                  <p className="text-gray-500 mt-0.5">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-gray-700/30 rounded-xl p-4 text-center border border-gray-600/50">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
