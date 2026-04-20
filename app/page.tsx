"use client";

import { GridCanvas } from "@/components/grid/GridCanvas";
import { useDots } from "@/lib/grid/dotsApi";

export default function Home() {
  const { dots, createDot, updateDot, deleteDot, isCloud } = useDots();

  return (
    <main className="h-dvh w-dvw">
      <GridCanvas
        dots={dots}
        isCloud={isCloud}
        onCreateDot={createDot}
        onUpdateDot={updateDot}
        onDeleteDot={deleteDot}
      />
    </main>
  );
}
