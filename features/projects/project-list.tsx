"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { archiveProject, createProject } from "./actions";

export function ProjectList({ items }: { items: { id: string; name: string; description: string | null }[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createProject(name);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setName("");
            router.push(`/projects/${res.id}`);
          });
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          aria-label="New project name"
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          Create project
        </Button>
      </form>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No projects yet. Confirming an idea creates one automatically.</p>
      )}
      <ul className="divide-y rounded-2xl border bg-card">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                start(async () => {
                  const res = await archiveProject(p.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  router.refresh();
                })
              }
            >
              Archive
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
