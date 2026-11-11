"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const fallback = () => <Skeleton className="h-44 w-full" />;

export const SimpleBar = dynamic(() => import("./charts").then((m) => m.SimpleBar), { ssr: false, loading: fallback });
export const StackedHeat = dynamic(() => import("./charts").then((m) => m.StackedHeat), { ssr: false, loading: fallback });
export const IntentBars = dynamic(() => import("./charts").then((m) => m.IntentBars), { ssr: false, loading: fallback });
