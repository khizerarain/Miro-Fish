import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NotesLoader } from "@/features/chat/notes-loader";

export const metadata: Metadata = { title: "Research notes" };

export default function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <FromParams params={params} />
    </Suspense>
  );
}

async function FromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NotesLoader experimentId={id} />;
}
