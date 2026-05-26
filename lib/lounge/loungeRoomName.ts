/** Canonical LiveKit room name for a user's always-on lounge. */
export function loungeRoomNameForUser(userId: string): string {
  return `lounge_${userId.replace(/-/g, "")}`;
}
