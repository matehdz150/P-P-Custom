"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { SearchProvider, useSearch } from "@/Contexts/SearchContext";
import SearchBar from "@/components/Catalogo/SearchBar";
import SearchText from "@/components/Catalogo/SearchText";
import SortSelect from "@/components/Catalogo/SortSelect";
import { Header } from "@/components/Header/Header";
import AppBreadcrumb from "@/components/shared/AppBreadCrumb";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SearchProvider>
            <Header />
            <CatalogLayoutContent>{children}</CatalogLayoutContent>
        </SearchProvider>
    );
}

function CatalogLayoutContent({ children }: { children: React.ReactNode }) {

    return (
        <div className="mt-4 w-full px-4 sm:px-6 md:px-10 lg:px-20 xl:px-32">
            <main className="mt-4">{children}</main>
        </div>
    );
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
