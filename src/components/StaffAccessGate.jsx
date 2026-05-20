import { useAuth } from "../context/AuthContext";

export function PendingStaffApprovalScreen() {
	const { signOut, user } = useAuth();
	const email = user?.email || "";

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-6">
			<div className="max-w-md text-center space-y-4">
				<h1 className="text-xl font-semibold text-white">
					Awaiting admin approval
				</h1>
				<p className="text-zinc-400 text-sm leading-relaxed">
					You signed in with Google as{" "}
					<span className="text-zinc-300 font-medium">{email || "this account"}</span>.
					An administrator needs to approve your account and assign a role before you can use the app.
				</p>
				<p className="text-zinc-600 text-xs">
					You will gain access automatically after approval — try signing in again later if you were just added.
				</p>
				<button
					type="button"
					onClick={() => signOut()}
					className="mt-4 px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800/80 transition text-sm font-medium"
				>
					Sign out
				</button>
			</div>
		</div>
	);
}

export function StaffRequestDeclinedScreen() {
	const { signOut, user } = useAuth();
	const email = user?.email || "";

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-6">
			<div className="max-w-md text-center space-y-4">
				<h1 className="text-xl font-semibold text-white">
					Access not granted
				</h1>
				<p className="text-zinc-400 text-sm leading-relaxed">
					A registration request for{" "}
					<span className="text-zinc-300 font-medium">{email || "this Google account"}</span>{" "}
					was dismissed by an administrator.
				</p>
				<p className="text-zinc-600 text-xs">
					If this was a mistake, contact your organisation&apos;s admin — they can approve your Google sign-in from the Users page.
				</p>
				<button
					type="button"
					onClick={() => signOut()}
					className="mt-4 px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800/80 transition text-sm font-medium"
				>
					Sign out
				</button>
			</div>
		</div>
	);
}
