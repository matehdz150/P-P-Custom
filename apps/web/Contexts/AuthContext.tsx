"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
import { fetchMe } from "@/lib/api/api";

type User = {
	id: string;
	email: string;
	name: string | null;
};

type AuthContextType = {
	user: User | null;
	loading: boolean;
	refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	const loadUser = async () => {
		try {
			const me = await fetchMe();
			setUser(me);
		} catch {
			setUser(null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadUser();
	}, []);

	return (
		<AuthContext.Provider
			value={{
				user,
				loading,
				refresh: loadUser,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
