"use client";

import { RoomEmbed } from "@/components/live/RoomEmbed";

export function LoungeRoom({
  roomName,
  displayName,
}: {
  roomName: string;
  displayName: string;
}) {
  return <RoomEmbed roomName={roomName} displayName={displayName} />;
}
