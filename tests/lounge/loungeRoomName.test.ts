import { describe, expect, it } from "vitest";
import { loungeRoomNameForUser } from "@/lib/lounge/loungeRoomName";

describe("loungeRoomNameForUser", () => {
  it("strips hyphens from the user id", () => {
    expect(loungeRoomNameForUser("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "lounge_a1b2c3d4e5f67890abcdef1234567890",
    );
  });
});
