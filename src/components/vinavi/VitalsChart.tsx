"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { VitalSign } from "@/lib/mock-data";

interface VitalsChartProps {
  vitals: (VitalSign & { episodeId: string })[];
}

export default function VitalsChart({ vitals }: VitalsChartProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsReady(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const data = vitals.map((v) => ({
    time: new Date(v.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    "Heart Rate": v.heartRate,
    "SpO2": v.spo2,
    "Temp (°C)": v.temp,
    "Resp Rate": v.respRate,
  }));

  if (!isReady) {
    return <div className="h-full w-full" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={{ stroke: "#cbd5e1" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={{ stroke: "#cbd5e1" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            fontSize: 11,
            color: "#0f172a",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, color: "#475569" }}
        />
        <Line type="monotone" dataKey="Heart Rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="SpO2" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Temp (°C)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Resp Rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
