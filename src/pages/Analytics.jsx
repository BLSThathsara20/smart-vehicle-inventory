import { useEffect, useMemo, useState } from 'react'
import {
  fetchVehiclesWithWorkPathAnalytics,
  fetchSoldVehiclesAnalyticsTimeline,
  fetchWorkshopServicesCompletedForAnalytics,
  vehicleCounts,
  normalizeVehicleWorkflowInstances,
} from '../lib/sanityData'
import {
  aggregateWorkflowTimeByUser,
  aggregateCompletedSessionsCount,
  soldActivityByMonth,
  workshopCompletedByMonth,
} from '../lib/workflowAnalytics'
import { formatDurationMs } from '../lib/workflowTime'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { BarChart3, Info } from 'lucide-react'
import { LoadingState } from '../components/LoadingState'

const CHART_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#fbbf24', '#2dd4bf', '#c084fc']

const gbpFmt = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

function chartTooltipStyle() {
  return {
    contentStyle: {
      backgroundColor: 'rgb(24 24 27)',
      border: '1px solid rgb(63 63 70)',
      borderRadius: '8px',
      fontSize: '12px',
    },
    labelStyle: { color: 'rgb(212 212 216)' },
  }
}

export function Analytics() {
  const { hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const canView = hasPermission('analytics:view')
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('Loading analytics…')
  const [counts, setCounts] = useState(null)
  const [workflowRows, setWorkflowRows] = useState([])
  const [soldRows, setSoldRows] = useState([])
  const [workshopCompleted, setWorkshopCompleted] = useState([])

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoadMessage('Loading inventory counts…')
        const c = await vehicleCounts()
        if (cancelled) return
        setCounts(c)
        setLoadMessage('Loading vehicles with workflow timer data…')
        const w = await fetchVehiclesWithWorkPathAnalytics(500)
        if (cancelled) return
        setWorkflowRows(w || [])
        setLoadMessage('Loading sold-vehicle timeline…')
        const s = await fetchSoldVehiclesAnalyticsTimeline(500)
        if (!cancelled) setSoldRows(s || [])
        setLoadMessage('Loading workshop completion revenue…')
        const ws = await fetchWorkshopServicesCompletedForAnalytics(2000)
        if (!cancelled) setWorkshopCompleted(ws || [])
      } catch (e) {
        if (!cancelled) addNotification(e.message || 'Failed to load analytics', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canView, addNotification])

  const inventoryPie = useMemo(() => {
    if (!counts) return []
    return [
      { name: 'Available', value: counts.available || 0 },
      { name: 'Newly arrived', value: counts.newly_arrived || 0 },
      { name: 'Reserved', value: counts.reserved || 0 },
      { name: 'Sold', value: counts.sold || 0 },
    ].filter((x) => x.value > 0)
  }, [counts])

  const soldByMonthWithRev = useMemo(() => soldActivityByMonth(soldRows, 12), [soldRows])

  const workshopByMonth = useMemo(
    () => workshopCompletedByMonth(workshopCompleted, 12),
    [workshopCompleted],
  )

  const rollup12 = useMemo(() => {
    const carsSold = soldByMonthWithRev.reduce((a, x) => a + x.count, 0)
    const saleRev = soldByMonthWithRev.reduce((a, x) => a + x.revenue, 0)
    const wsJobs = workshopByMonth.reduce((a, x) => a + x.jobs, 0)
    const wsRev = workshopByMonth.reduce((a, x) => a + x.revenue, 0)
    return { carsSold, saleRev, wsJobs, wsRev }
  }, [soldByMonthWithRev, workshopByMonth])

  const timeByUser = useMemo(() => aggregateWorkflowTimeByUser(workflowRows), [workflowRows])

  const completedSessions = useMemo(() => aggregateCompletedSessionsCount(workflowRows), [workflowRows])

  const pathStats = useMemo(() => {
    let activePaths = 0
    let completedPaths = 0
    let sumWallMs = 0
    let wallSamples = 0
    for (const row of workflowRows) {
      const v = row?.id ? row : { ...row, id: row._id, ops_workflows: row.ops_workflows, ops_workflow: row.ops_workflow }
      for (const inst of normalizeVehicleWorkflowInstances(v)) {
        if (inst.status === 'active') activePaths += 1
        if (inst.status === 'done') {
          completedPaths += 1
          if (inst.started_at && inst.finished_at) {
            const ms = new Date(inst.finished_at) - new Date(inst.started_at)
            if (ms > 0) {
              sumWallMs += ms
              wallSamples += 1
            }
          }
        }
      }
    }
    const avgWall =
      wallSamples > 0 ? formatDurationMs(Math.round(sumWallMs / wallSamples)) : '—'
    return { activePaths, completedPaths, avgWall }
  }, [workflowRows])

  const timeBarData = useMemo(
    () =>
      timeByUser.map((r) => ({
        name: (r.label || r.uid).slice(0, 18) + ((r.label || r.uid).length > 18 ? '…' : ''),
        hours: Math.round((r.totalMs / 3600000) * 10) / 10,
        sessions: r.sessions,
        fullLabel: r.label || r.uid,
      })),
    [timeByUser]
  )

  if (!canView) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to view analytics.</p>
        <p className="text-zinc-600 text-sm mt-2">
          An administrator can grant <span className="text-zinc-500">View analytics</span> to your role under Roles
          &amp; permissions.
        </p>
      </div>
    )
  }

  if (loading) {
    return <LoadingState message={loadMessage} variant="embedded" className="py-24" />
  }

  return (
    <div className="space-y-10 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-amber-500" />
          Analytics
        </h1>
        <p className="text-zinc-500 text-sm mt-1 max-w-2xl">
          Inventory mix, sales counts and approximate revenue ({' '}
          <span className="text-zinc-400">agreed deal price when set, otherwise list price</span>
          ), completed workshop takings by month, and work-path time by person (timer sessions).
        </p>
        <p className="mt-3 flex gap-2 text-[11px] text-zinc-600 leading-relaxed max-w-3xl">
          <Info className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
          <span>
            Sale charts use each sold vehicle&apos;s document{' '}
            <span className="text-zinc-500">_updatedAt</span> as a proxy for sale month — not a contract date — and analyse the
            most recent inventory sample fetched from Sanity. Workshop revenue uses completed jobs attributed to{' '}
            <span className="text-zinc-500">completed_at</span> (fallback scheduled date). Timer charts sum only completed timer
            sessions.
          </span>
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Cars sold (12 mo)</p>
          <p className="text-2xl font-semibold text-white tabular-nums mt-1">{rollup12.carsSold}</p>
          <p className="text-[11px] text-zinc-600 mt-1">In latest sold-inventory sample.</p>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Sale revenue (12 mo)</p>
          <p className="text-2xl font-semibold text-emerald-400/95 tabular-nums mt-1">{gbpFmt.format(rollup12.saleRev)}</p>
          <p className="text-[11px] text-zinc-600 mt-1">Agreed deal if set.</p>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Workshop jobs (12 mo)</p>
          <p className="text-2xl font-semibold text-white tabular-nums mt-1">{rollup12.wsJobs}</p>
          <p className="text-[11px] text-zinc-600 mt-1">Completed services in sample.</p>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Workshop revenue (12 mo)</p>
          <p className="text-2xl font-semibold text-sky-400/95 tabular-nums mt-1">{gbpFmt.format(rollup12.wsRev)}</p>
          <p className="text-[11px] text-zinc-600 mt-1">Sum of logged service prices.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 md:p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Inventory mix</h2>
          <p className="text-xs text-zinc-500 mb-4">Current vehicles by status</p>
          <div className="h-[260px] w-full min-w-0">
            {inventoryPie.length === 0 ? (
              <p className="text-zinc-600 text-sm py-12 text-center">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inventoryPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {inventoryPie.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgb(39 39 42)" />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 md:p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Sales by month</h2>
          <p className="text-xs text-zinc-500 mb-4">Cars sold and approximate revenue (same month buckets)</p>
          <div className="h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={soldByMonthWithRev} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" />
                <XAxis dataKey="label" tick={{ fill: 'rgb(161 161 170)', fontSize: 11 }} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'rgb(161 161 170)', fontSize: 11 }}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: 'rgb(161 161 170)', fontSize: 10 }}
                  axisLine={false}
                  tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}`}
                  width={44}
                />
                <Tooltip
                  {...chartTooltipStyle()}
                  formatter={(v, name) =>
                    name === 'revenue' ? [gbpFmt.format(Number(v)), 'Sale revenue (approx.)'] : [v, 'Cars sold']
                  }
                  labelFormatter={(l) => l}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  name="Cars sold"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="Sale revenue"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#34d399' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 md:p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Workshop revenue by month</h2>
        <p className="text-xs text-zinc-500 mb-4">Completed bookings with a service price, by completion month</p>
        <div className="h-[260px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workshopByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" />
              <XAxis dataKey="label" tick={{ fill: 'rgb(161 161 170)', fontSize: 11 }} axisLine={false} />
              <YAxis
                tick={{ fill: 'rgb(161 161 170)', fontSize: 11 }}
                axisLine={false}
                tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}`}
              />
              <Tooltip
                {...chartTooltipStyle()}
                formatter={(v, _n, p) => [
                  `${gbpFmt.format(Number(v))} · ${p?.payload?.jobs ?? 0} job(s)`,
                  'Workshop takings',
                ]}
              />
              <Bar dataKey="revenue" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 md:p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Work-path time by person</h2>
        <p className="text-xs text-zinc-500 mb-2">
          Sum of completed timer sessions across vehicles with a prep path ({completedSessions} sessions in sample).
        </p>
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-zinc-400">
          <span>
            Active paths in sample:{' '}
            <span className="text-amber-400/90 font-medium tabular-nums">{pathStats.activePaths}</span>
          </span>
          <span>
            Completed paths:{' '}
            <span className="text-zinc-300 font-medium tabular-nums">{pathStats.completedPaths}</span>
          </span>
          <span>
            Avg. calendar span (done paths):{' '}
            <span className="text-zinc-300 font-medium">{pathStats.avgWall}</span>
          </span>
        </div>
        <div
          className="w-full min-w-0"
          style={{ height: `${Math.min(420, Math.max(220, timeBarData.length * 44))}px` }}
        >
          {timeBarData.length === 0 ? (
            <p className="text-zinc-600 text-sm py-10 text-center">No completed timer sessions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={timeBarData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(39 39 42)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'rgb(161 161 170)', fontSize: 11 }} axisLine={false} unit=" h" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fill: 'rgb(212 212 216)', fontSize: 11 }}
                  axisLine={false}
                />
                <Tooltip
                  {...chartTooltipStyle()}
                  formatter={(value, _n, props) => [`${value} h`, 'Logged']}
                  labelFormatter={(_, p) => p?.payload?.fullLabel || ''}
                />
                <Bar dataKey="hours" fill="#38bdf8" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  )
}
