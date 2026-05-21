import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { NotificationBell } from "./NotificationBell";
import { BrowserNotificationManager } from "./BrowserNotificationManager";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { useAuth } from "../context/AuthContext";

export function Layout() {
	const { pathname } = useLocation();
	const { hasPermission } = useAuth();
	const showCommandSearch =
		hasPermission("search:view") ||
		hasPermission("inventory:view") ||
		hasPermission("users:manage");
	/** Sticky omnibar only on Dashboard / Overview (`/app`); elsewhere it scrolls with the page */
	const omnibarSticky =
		pathname === "/app" ||
		pathname === "/app/";

	return (
		<div className="min-h-screen bg-zinc-950 text-white md:flex">
			<BrowserNotificationManager />
			<Sidebar />
			<div className="flex-1 md:pl-56 min-h-screen flex flex-col relative">
				<div className="absolute top-3 right-3 md:top-4 md:right-6 z-[120] print:hidden">
					<NotificationBell />
				</div>
				{showCommandSearch ? (
					<div
						className={`print:hidden isolate shrink-0 z-[110] overflow-visible border-b border-zinc-800/55 bg-zinc-950 backdrop-blur-md ${
							omnibarSticky ? "sticky top-0" : ""
						}`}
					>
						<div className="w-full max-w-lg md:max-w-5xl mx-auto px-4 pr-14 md:px-6 md:pr-20 py-3">
							<GlobalSearchBar />
						</div>
					</div>
				) : null}
				<main
					className={`relative z-0 flex-1 w-full max-w-lg md:max-w-5xl mx-auto px-4 pb-24 md:pb-8 ${
						showCommandSearch ? "pt-6 md:pt-8" : "pt-16 md:pt-16"
					}`}
				>
					<Outlet />
				</main>
				<Footer />
			</div>
			<div className="md:hidden">
				<BottomNav />
			</div>
		</div>
	);
}
