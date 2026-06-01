'use client'

import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { formatCost, getProviderColor, getProviderName } from '@/lib/utils'
import type { ModelUsage, ProviderUsage } from '@/lib/types'

interface CostBreakdownBarProps {
  data: ModelUsage[]
  height?: number
}

interface ProviderDonutProps {
  data: ProviderUsage[]
  height?: number
}

const MODEL_COLORS = ['#7c3aed', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; name: string }>
  label?: string
}

function CostTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '0.75rem 1rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>{label}</p>
      {payload.map(entry => (
        <p key={entry.dataKey} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Cost: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCost(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

function CostBreakdownBar({ data, height = 280 }: CostBreakdownBarProps) {
  const chartData = data.slice(0, 8).map(d => ({
    name: d.modelName.length > 16 ? d.modelName.slice(0, 16) + '…' : d.modelName,
    cost: d.cost,
    provider: d.provider,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#555566' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={val => formatCost(val)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#8888a0' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CostTooltip />} />
        <Bar dataKey="cost" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getProviderColor(entry.provider)}
              opacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface DonutTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { percentage: number } }>
}

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '0.75rem 1rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {getProviderName(item.name)}
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Cost: <strong style={{ color: 'var(--text-primary)' }}>{formatCost(item.value)}</strong>
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Share: <strong style={{ color: 'var(--text-primary)' }}>{item.payload.percentage.toFixed(1)}%</strong>
      </p>
    </div>
  )
}

function ProviderDonut({ data, height = 280 }: ProviderDonutProps) {
  const chartData = data.map(d => ({
    name: d.provider,
    value: d.cost,
    percentage: d.percentage,
  }))

  const RADIAN = Math.PI / 180
  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percentage,
  }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percentage: number
  }) => {
    if (percentage < 5) return null
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: '0.75rem', fontWeight: 600 }}
      >
        {`${percentage.toFixed(0)}%`}
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={3}
          dataKey="value"
          labelLine={false}
          label={renderLabel}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getProviderColor(entry.name)}
            />
          ))}
        </Pie>
        <Tooltip content={<DonutTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {getProviderName(value)}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export { CostBreakdownBar, ProviderDonut }
