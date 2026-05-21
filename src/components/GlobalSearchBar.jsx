import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	Search as SearchIcon,
	Loader2,
	Car,
	ContactRound,
	Wrench,
	Users as UsersIcon,
} from "lucide-react";
import { globalOmniSearch } from "../lib/sanityData";
import { useAuth } from "../context/AuthContext";

function fmtNiceDate(iso) {
	if (!iso) return "";
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return "";
		return d.toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

function vehicleSubtitle(v) {
	const bits = [
		v.stock_id && `#${v.stock_id}`,
		v.plate_no && String(v.plate_no),
		v.brand && v.model ? `${v.brand} ${v.model}` : v.brand || v.model,
	];
	return bits.filter(Boolean).join(" · ");
}

/** Omnibar — vehicles, CRM contacts on stock, workshop services, team (scoped by permissions). Sticky positioning is controlled in Layout (Overview only). */
export function GlobalSearchBar() {
	const navigate = useNavigate();
	const { hasPermission } = useAuth();
	const wrapRef = useRef(null);
	const inputRef = useRef(null);

	const wantVehicles =
		hasPermission("search:view") || hasPermission("inventory:view");
	const wantCrmExtras = hasPermission("inventory:view");
	const wantTeam = hasPermission("users:manage");

	const [q, setQ] = useState("");
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState(null);

	useEffect(() => {
		function onDocMouseDown(e) {
			if (wrapRef.current && !wrapRef.current.contains(e.target)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", onDocMouseDown);
		return () => document.removeEventListener("mousedown", onDocMouseDown);
	}, []);

	const runSearch = useCallback(
		async (raw) => {
			const trimmed = raw.trim();
			if (trimmed.length < 2) {
				setResults(null);
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const data = await globalOmniSearch(trimmed, {
					vehicles: wantVehicles,
					contacts: wantCrmExtras,
					services: wantCrmExtras,
					team: wantTeam,
				});
				setResults(data);
			} catch {
				setResults({
					vehicles: [],
					contactVehicles: [],
					services: [],
					team: [],
				});
			} finally {
				setLoading(false);
			}
		},
		[wantVehicles, wantCrmExtras, wantTeam],
	);

	useEffect(() => {
		const trimmed = q.trim();
		if (trimmed.length < 2) {
			setResults(null);
			setLoading(false);
			return;
		}
		const timer = setTimeout(() => runSearch(trimmed), 260);
		return () => clearTimeout(timer);
	}, [q, runSearch]);

	if (!wantVehicles && !wantCrmExtras && !wantTeam) return null;

	const hasAnyHits =
		results &&
		(results.vehicles?.length ||
			results.contactVehicles?.length ||
			results.services?.length ||
			results.team?.length);

	const goVehicle = (id) => {
		setOpen(false);
		inputRef.current?.blur();
		navigate(`/vehicle/${id}`);
	};

	const goService = (svc) => {
		setOpen(false);
		inputRef.current?.blur();
		if (svc?.inventory_vehicle_id) {
			navigate(`/vehicle/${svc.inventory_vehicle_id}`);
			return;
		}
		navigate("/app/services");
	};

	const goTeam = () => {
		setOpen(false);
		inputRef.current?.blur();
		navigate("/app/users");
	};

	return (
		<div ref={wrapRef} className="relative w-full max-w-2xl">
			<label className="sr-only" htmlFor="global-command-search">
				Search workspace
			</label>
			<div className="relative">
				<SearchIcon
					className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
					aria-hidden
				/>
				<input
					ref={inputRef}
					id="global-command-search"
					type="search"
					autoComplete="off"
					spellCheck="false"
					value={q}
					onChange={(e) => {
						setQ(e.target.value);
						setOpen(true);
					}}
					onFocus={() => {
						setOpen(true);
					}}
					placeholder={
						wantCrmExtras
							? "Search vehicles, customers, services, team…"
							: wantTeam && !wantVehicles
								? "Search team members…"
								: "Search vehicles…"
					}
					className="w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 py-2.5 pl-10 pr-10 text-[15px] text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/20 outline-none ring-amber-500/0 transition focus:border-amber-500/35 focus:bg-zinc-900/85 focus:ring-2 focus:ring-amber-500/15"
				/>
				{loading && (
					<Loader2
						className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-amber-500/80"
						aria-hidden
					/>
				)}
			</div>

			{open && q.trim().length >= 2 && (
				<div
					className="absolute left-0 right-0 top-full z-[130] mt-2 max-h-[min(440px,calc(100vh-8rem))] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 py-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.75)] ring-1 ring-zinc-800/90"
					role="listbox"
					aria-label="Search suggestions"
				>
					{loading && (
						<p className="px-4 py-6 text-center text-sm text-zinc-500">
							Searching…
						</p>
					)}
					{!loading && !hasAnyHits && (
						<p className="px-4 py-6 text-center text-sm text-zinc-500">
							No matches. Try plate, stock #, name, email, or service note.
						</p>
					)}
					{!loading &&
						results?.vehicles?.length > 0 &&
						wantVehicles && (
							<div className="px-2 pb-1">
								<p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
									Vehicles
								</p>
								<ul className="space-y-0.5">
									{results.vehicles.map((v) => (
										<li key={v.id}>
											<button
												type="button"
												role="option"
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => goVehicle(v.id)}
												className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-800/90"
											>
												<Car className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90" />
												<span className="min-w-0">
													<span className="block truncate text-[13px] font-medium text-zinc-100">
														{v.brand} {v.model}
													</span>
													<span className="block truncate text-[12px] text-zinc-500">
														{vehicleSubtitle(v)}
													</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						)}
					{!loading &&
						results?.contactVehicles?.length > 0 &&
						wantCrmExtras && (
							<div className="border-t border-zinc-800/80 px-2 py-2">
								<p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
									Customers on stock
								</p>
								<ul className="space-y-0.5">
									{results.contactVehicles.map((v) => (
										<li key={v.id}>
											<button
												type="button"
												role="option"
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => goVehicle(v.id)}
												className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-800/90"
											>
												<ContactRound className="mt-0.5 h-4 w-4 shrink-0 text-sky-400/90" />
												<span className="min-w-0">
													<span className="block truncate text-[13px] font-medium text-zinc-100">
														{v.label}
													</span>
													<span className="block truncate text-[12px] text-zinc-500">
														{vehicleSubtitle(v)}
													</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						)}
					{!loading &&
						results?.services?.length > 0 &&
						wantCrmExtras && (
							<div className="border-t border-zinc-800/80 px-2 py-2">
								<p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
									Services
								</p>
								<ul className="space-y-0.5">
									{results.services.map((s) => (
										<li key={s.id}>
											<button
												type="button"
												role="option"
												onMouseDown={(e) => e.preventDefault()}
												onClick={() => goService(s)}
												className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-800/90"
											>
												<Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" />
												<span className="min-w-0">
													<span className="block truncate text-[13px] font-medium text-zinc-100">
														{s.customer_name ||
															[s.vehicle_make, s.vehicle_model]
																.filter(Boolean)
																.join(" ") ||
															"Workshop"}
													</span>
													<span className="block truncate text-[12px] text-zinc-500">
														{s.plate ||
															fmtNiceDate(s.scheduled_at) ||
															s.location}
														{s.status !== "scheduled" && (
															<>
																{" · "}
																{s.status}
															</>
														)}
													</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						)}
					{!loading && results?.team?.length > 0 && wantTeam && (
						<div className="border-t border-zinc-800/80 px-2 py-2">
							<p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
								Team
							</p>
							<ul className="space-y-0.5">
								{results.team.map((u) => (
									<li key={u.id}>
										<button
											type="button"
											role="option"
											onMouseDown={(e) => e.preventDefault()}
											onClick={goTeam}
											className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-800/90"
										>
											<UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/90" />
											<span className="min-w-0">
												<span className="block truncate text-[13px] font-medium text-zinc-100">
													{u.display_name?.trim() || u.email || "User"}
												</span>
												<span className="block truncate text-[12px] text-zinc-500">
													{u.email}
													{u.roleName ? ` · ${u.roleName}` : ""}
												</span>
											</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
