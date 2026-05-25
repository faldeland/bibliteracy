"use client";

import { LoungeVideoRoom } from "@/components/lounge/LoungeVideoRoom";

interface RoomEmbedProps {
  roomName: string;
  displayName?: string;
}

export function RoomEmbed({ roomName, displayName }: RoomEmbedProps) {
  return (
    <LoungeVideoRoom
      roomName={roomName}
      displayName={displayName}
      layout="full"
    />
  );
}
