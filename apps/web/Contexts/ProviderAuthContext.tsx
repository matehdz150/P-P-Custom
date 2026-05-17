"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { type Provider, providerMe } from "@/lib/api/providers";

type Ctx = {
	provider: Provider | null;
	loading: boolean;
	refresh: () => Promise<void>;
};

const ProviderAuthContext = createContext<Ctx | null>(null);

export function ProviderAuthProvider({ children }: { children: ReactNode }) {
	const [provider, setProvider] = useState<Provider | null>(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		try {
			setProvider(await providerMe());
		} catch {
			setProvider(null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	return (
		<ProviderAuthContext.Provider
			value={{ provider, loading, refresh: load }}
		>
			{children}
		</ProviderAuthContext.Provider>
	);
}

export function useProviderAuth() {
	const ctx = useContext(ProviderAuthContext);
	if (!ctx)
		throw new Error(
			"useProviderAuth debe usarse dentro de ProviderAuthProvider",
		);
	return ctx;
}
