import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContactRound, ExternalLink, Search } from 'lucide-react'
import { fetchVehiclesForCustomersDirectory } from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { LoadingState } from '../components/LoadingState'

function fmtDate(iso) {
	if (!iso) return '—'
	try {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		})
	} catch {
		return String(iso)
	}
}

function fmtMoney(n) {
	if (n == null || n === '') return '—'
	const x = typeof n === 'number' ? n : Number(n)
	return Number.isFinite(x) ? `£${x.toLocaleString('en-GB', { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : '—'
}

function VehicleLine({ row }) {
	return (
		<Link
			to={`/vehicle/${row.id}`}
			className="block rounded-xl border border-zinc-700/70 bg-zinc-900/50 hover:bg-zinc-800/70 hover:border-amber-500/30 px-3 py-3 transition"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-sm font-medium text-white truncate">
						{row.displayName}
						{row.customer_email ? (
							<span className="font-normal text-zinc-400 hidden sm:inline"> · {row.customer_email}</span>
						) : null}
					</p>
					<p className="text-xs text-zinc-500 mt-1">
						Vehicle{' '}
						<span className="text-amber-400/90">
							{(() => {
								const inv = [row.stock_id, row.plate_no].filter(Boolean).join(' · ');
								const car = [row.brand, row.model].filter(Boolean).join(' ');
								return [inv, car].filter(Boolean).join(' · ');
							})()}
						</span>
					</p>
					{row.customer_phone ? (
						<p className="text-xs text-zinc-400 mt-1">{row.customer_phone}</p>
					) : null}
				</div>
				<ExternalLink className="w-4 h-4 text-zinc-500 shrink-0 mt-1" aria-hidden />
			</div>
			{row.meta && <p className="text-[11px] text-zinc-600 mt-2">{row.meta}</p>}
		</Link>
	);
}

/** Build flat rows grouped into categories for CRM-style lists */
function categorize(vehicles) {
	const reservations = [];
	const sold = [];
	const viewingLeads = [];
	const archived = [];

	for (const v of vehicles || []) {
		const vm = [v.stock_id, v.plate_no, v.brand, v.model].filter(Boolean).join(' ').toLowerCase();

		if (v.reserved && !v.sold && (v.customer_name || v.customer_email || v.customer_phone)) {
			reservations.push({
				key: `${v.id}-res`,
				id: v.id,
				stock_id: v.stock_id,
				plate_no: v.plate_no,
				brand: v.brand,
				model: v.model,
				displayName: v.customer_name || 'Reserved customer',
				customer_email: v.customer_email,
				customer_phone: v.customer_phone,
				meta: `Reserved · Deposit ${fmtMoney(v.deposit_amount)} · Pulout ${fmtDate(v.planned_collection_date)} · Reserved ${fmtDate(v.reserved_date)}`,
				searchHay: `${vm} ${v.customer_name} ${v.customer_email} ${v.customer_phone}`,
			});
		}

		if (v.sold && (v.buyers_name || v.customer_name || v.customer_phone || v.customer_email)) {
			const name = v.buyers_name || v.customer_name || 'Buyer';
			sold.push({
				key: `${v.id}-sold`,
				id: v.id,
				stock_id: v.stock_id,
				plate_no: v.plate_no,
				brand: v.brand,
				model: v.model,
				displayName: name,
				customer_email: v.customer_email,
				customer_phone: v.customer_phone,
				meta: `Sold · Listed price ${fmtMoney(v.selling_price)}`,
				searchHay: `${vm} ${name} ${v.customer_email} ${v.customer_phone}`,
			});
		}

		for (const b of v.viewing_bookings || []) {
			const st = b.status || 'scheduled';
			if (['cancelled', 'no_show'].includes(st)) continue;
			viewingLeads.push({
				key: `${v.id}-vb-${b._key}`,
				id: v.id,
				stock_id: v.stock_id,
				plate_no: v.plate_no,
				brand: v.brand,
				model: v.model,
				displayName: b.customer_name || 'Viewing',
				customer_email: b.customer_email,
				customer_phone: b.customer_phone,
				meta: `Viewing (${st.replace('_', ' ')}) · ${b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}`,
				searchHay: `${vm} ${b.customer_name} ${b.customer_email} ${b.customer_phone} ${b.notes}`,
			});
		}

		if (
			!v.reserved &&
			!v.sold &&
			(v.customer_name || v.customer_email || v.customer_phone) &&
			['Withdrawn'].includes(v.vehicle_status)
		) {
			archived.push({
				key: `${v.id}-archive`,
				id: v.id,
				stock_id: v.stock_id,
				plate_no: v.plate_no,
				brand: v.brand,
				model: v.model,
				displayName: v.customer_name || 'Contact',
				customer_email: v.customer_email,
				customer_phone: v.customer_phone,
				meta: `${v.vehicle_status || 'Not active'} · previous contact`,
				searchHay: `${vm} ${v.customer_name} ${v.customer_email} ${v.customer_phone}`,
			});
		}
	}

	return { reservations, sold, viewingLeads, archived };
}

function Section({ title, subtitle, rows, accentClass }) {
	if (!rows.length) return null;
	return (
		<section className="mb-10">
			<h2 className={`text-sm font-semibold uppercase tracking-wide ${accentClass}`}>{title}</h2>
			{subtitle && <p className="text-xs text-zinc-500 mt-1 mb-3">{subtitle}</p>}
			<div className="space-y-2">
				{rows.map((row) => (
					<VehicleLine key={row.key} row={row} />
				))}
			</div>
		</section>
	);
}

export function Customers() {
	const { hasPermission } = useAuth()
	const canView = hasPermission('inventory:view')
	const { addNotification } = useNotification();
	const [loading, setLoading] = useState(true);
	const [vehicles, setVehicles] = useState([]);
	const [query, setQuery] = useState('');

	const grouped = useMemo(() => categorize(vehicles), [vehicles]);

	const filterRows = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q)
			return {
				reservations: grouped.reservations,
				sold: grouped.sold,
				viewingLeads: grouped.viewingLeads,
				archived: grouped.archived,
			};
		const match = (rows) =>
			rows.filter((r) => (r.searchHay || '').toLowerCase().includes(q));
		return {
			reservations: match(grouped.reservations),
			sold: match(grouped.sold),
			viewingLeads: match(grouped.viewingLeads),
			archived: match(grouped.archived),
		};
	}, [grouped, query]);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			try {
				const data = await fetchVehiclesForCustomersDirectory();
				if (!cancelled) setVehicles(data || []);
			} catch (e) {
				if (!cancelled) addNotification(e.message || 'Failed to load customers', 'error');
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		if (canView) load();
		else setLoading(false);
		return () => {
			cancelled = true;
		};
	}, [canView, addNotification]);

	const totalShown =
		filterRows.reservations.length +
		filterRows.sold.length +
		filterRows.viewingLeads.length +
		filterRows.archived.length;

	if (!canView) {
		return (
			<div className="text-zinc-400 text-center py-16">
				You don&apos;t have permission to view this directory.
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-xl font-bold text-white flex items-center gap-2">
					<ContactRound className="w-7 h-7 text-amber-400" />
					Customers &amp; leads
				</h1>
				<p className="text-sm text-zinc-500 mt-1 max-w-2xl">
					Reservation customers, buyers, viewing appointments, and archived contacts pulled from inventory.
				</p>
			</div>

			<label className="relative block mb-8">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search name, email, phone, stock, plate, model…"
					className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
				/>
			</label>

			{loading ? (
				<LoadingState message="Loading customer directory…" />
			) : totalShown === 0 ? (
				<p className="text-zinc-400 text-center py-16">
					{query.trim() ? 'No matches for that search.' : 'No customer or viewing rows yet.'}
				</p>
			) : (
				<>
					<Section
						title="Active reservations"
						subtitle="Customers tied to vehicles currently marked reserved."
						rows={filterRows.reservations}
						accentClass="text-emerald-400"
					/>
					<Section
						title="Sold — buyers"
						subtitle="Use for follow-up, surveys, service upsell."
						rows={filterRows.sold}
						accentClass="text-sky-400"
					/>
					<Section
						title="Viewing appointments"
						subtitle="Prospects booked on a vehicle (scheduled / completed)."
						rows={filterRows.viewingLeads}
						accentClass="text-amber-400"
					/>
					<Section
						title="Archived contacts"
						subtitle="Withdrawn stock that still carried contact fields."
						rows={filterRows.archived}
						accentClass="text-zinc-400"
					/>
				</>
			)}
		</div>
	);
}
