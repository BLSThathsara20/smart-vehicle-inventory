import { createContext, useContext, useEffect, useState } from "react";
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
	createUserWithEmailAndPassword,
	GoogleAuthProvider,
	signInWithPopup,
} from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import { hasSanityConfig } from "../lib/sanity";
import {
	fetchAuthLandingState,
	ensureBootstrap,
	ensureUserProfileForFirebaseUser,
} from "../lib/sanityData";

const AuthContext = createContext(null);

const PROFILE_CACHE_PREFIX = "vi-profile-cache:v1:";

function profileCacheKey(uid) {
	return `${PROFILE_CACHE_PREFIX}${uid}`;
}

const PROFILE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [profile, setProfile] = useState(null);
	/** When signed in without a profile: pending Google approval, dismissed request, or none (legacy no-access). */
	const [staffGate, setStaffGate] = useState(null);
	const [loading, setLoading] = useState(true);
	const [profileLoading, setProfileLoading] = useState(false);
	const configOk = hasFirebaseConfig() && hasSanityConfig;

	useEffect(() => {
		if (!auth || !configOk) {
			setLoading(false);
			return;
		}
		const unsub = onAuthStateChanged(auth, async (u) => {
			if (u) {
				try {
					await ensureBootstrap();
					await ensureUserProfileForFirebaseUser(u);
				} catch {
					/* profile bootstrap best-effort */
				}
			}
			setUser(u);
			setLoading(false);
		});
		return () => unsub();
	}, [configOk]);

	useEffect(() => {
		if (!configOk || !user?.uid) {
			setProfile(null);
			setStaffGate(null);
			setProfileLoading(false);
			return;
		}
		let cancelled = false;
		const key = profileCacheKey(user.uid);
		let usedCache = false;
		try {
			const raw = sessionStorage.getItem(key);
			if (raw) {
				const parsed = JSON.parse(raw);
				const { t, profile: cachedProfile, data } = parsed;
				const cached = cachedProfile || data;
				if (cached && t && Date.now() - t < PROFILE_CACHE_MAX_AGE_MS) {
					setProfile(cached);
					setStaffGate(null);
					usedCache = true;
					setProfileLoading(false);
				}
			}
		} catch {
			/* ignore corrupt cache */
		}
		if (!usedCache) setProfileLoading(true);

		fetchAuthLandingState(user.uid)
			.then(({ profile: p, staffGate: gate }) => {
				if (cancelled) return;
				setProfile(p);
				setStaffGate(p ? null : gate ?? "none");
				try {
					if (p)
						sessionStorage.setItem(
							key,
							JSON.stringify({ t: Date.now(), profile: p }),
						);
				} catch {
					/* private mode */
				}
			})
			.catch(() => {
				if (cancelled) return;
				setProfile(null);
				setStaffGate("none");
			})
			.finally(() => {
				if (!cancelled) setProfileLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [configOk, user?.uid]);

	const signIn = async (email, password) => {
		if (!auth) throw new Error("Firebase not configured");
		const cred = await signInWithEmailAndPassword(auth, email, password);
		return cred;
	};

	const signOutUser = async () => {
		if (!auth) return;
		const uid = auth.currentUser?.uid;
		try {
			if (uid) sessionStorage.removeItem(profileCacheKey(uid));
			sessionStorage.removeItem("vi-bootstrap-skip-until");
		} catch {
			/* ignore */
		}
		await signOut(auth);
		setProfile(null);
		setStaffGate(null);
	};

	const signUp = async (email, password) => {
		if (!auth) throw new Error("Firebase not configured");
		return createUserWithEmailAndPassword(auth, email, password);
	};

	const signInWithGoogle = async () => {
		if (!auth) throw new Error("Firebase not configured");
		const provider = new GoogleAuthProvider();
		provider.setCustomParameters({ prompt: "select_account" });
		return signInWithPopup(auth, provider);
	};

	const hasPermission = (code) => {
		if (profile) return profile.permissions?.includes(code) ?? false;
		return false;
	};

	/** Open Work paths page: any workflow permission or role admin. */
	const canAccessWorkPaths = () =>
		isSuperAdmin() ||
		hasPermission("roles:manage") ||
		hasPermission("workflows:create") ||
		hasPermission("workflows:edit") ||
		hasPermission("workflows:manage");

	/** New work path template. */
	const canCreateWorkPath = () =>
		isSuperAdmin() ||
		hasPermission("roles:manage") ||
		hasPermission("workflows:create") ||
		hasPermission("workflows:manage");

	/** Edit / delete templates; admin overrides on vehicle workflows. */
	const canEditWorkPath = () =>
		isSuperAdmin() ||
		hasPermission("roles:manage") ||
		hasPermission("workflows:edit") ||
		hasPermission("workflows:manage");

	const isSuperAdmin = () => {
		const role = profile?.role;
		const name = Array.isArray(role) ? role?.[0]?.name : role?.name;
		return String(name || "").toLowerCase() === "super_admin";
	};

	const refreshProfile = () => {
		if (!user?.uid) return;
		try {
			sessionStorage.removeItem(profileCacheKey(user.uid));
		} catch {
			/* ignore */
		}
		fetchAuthLandingState(user.uid)
			.then(({ profile: p, staffGate: gate }) => {
				setProfile(p);
				setStaffGate(p ? null : gate ?? "none");
				try {
					if (p)
						sessionStorage.setItem(
							profileCacheKey(user.uid),
							JSON.stringify({ t: Date.now(), profile: p }),
						);
				} catch {
					/* ignore */
				}
			})
			.catch(() => {
				setProfile(null);
				setStaffGate("none");
			});
	};

	/** True while Firebase auth is resolving or Sanity profile is loading */
	const ready = loading || (user && profileLoading);
	/** What the app is actually waiting on (for honest loading copy) */
	const loadingStage = loading
		? "firebase"
		: user && profileLoading
			? "profile"
			: null;

	return (
		<AuthContext.Provider
			value={{
				user,
				profile,
				staffGate,
				loading: ready,
				loadingStage,
				configOk,
				signIn,
				signOut: signOutUser,
				signUp,
				signInWithGoogle,
				hasPermission,
				canAccessWorkPaths,
				canCreateWorkPath,
				canEditWorkPath,
				isSuperAdmin,
				refreshProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
