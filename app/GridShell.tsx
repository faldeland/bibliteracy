"use client";

import { GridCanvas } from "@/components/grid/GridCanvas";
import { useDots } from "@/lib/grid/dotsApi";

interface GridShellProps {
  userId: string;
  displayName?: string | null;
  userEmail?: string | null;
}

/**
 * Client wrapper around the grid canvas. Receives the authenticated user's
 * id from the server component so the dots query is scoped from the very
 * first render (no "flash of anonymous data").
 */
export function GridShell({
  userId,
  displayName,
  userEmail,
}: GridShellProps) {
  const { dots, createDot, updateDot, deleteDot } = useDots(userId);

  return (
    <GridCanvas
      userId={userId}
      dots={dots}
      displayName={displayName ?? userEmail ?? null}
      onCreateDot={createDot}
      onUpdateDot={updateDot}
      onDeleteDot={deleteDot}
    />
  );
}
