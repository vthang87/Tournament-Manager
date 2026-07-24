import { ValidationError } from "@/application/errors";
import type { EventType, EntryMemberInput } from "./types";

export function requiredMemberCount(eventType: EventType): number {
  switch (eventType) {
    case "SINGLES":
      return 1;
    case "DOUBLES":
      return 2;
    case "TEAM":
      // V1: team size is flexible but at least 1; validate lower bound only.
      return 1;
    default: {
      const _exhaustive: never = eventType;
      return _exhaustive;
    }
  }
}

export function assertMemberCardinality(
  eventType: EventType,
  members: EntryMemberInput[],
): void {
  const required = requiredMemberCount(eventType);
  if (eventType === "TEAM") {
    if (members.length < required) {
      throw new ValidationError(
        `TEAM entries require at least ${required} member(s)`,
        "ENTRY_MEMBER_COUNT",
      );
    }
  } else if (members.length !== required) {
    throw new ValidationError(
      `${eventType} entries require exactly ${required} member(s)`,
      "ENTRY_MEMBER_COUNT",
    );
  }

  const playerIds = members.map((m) => m.playerId);
  if (new Set(playerIds).size !== playerIds.length) {
    throw new ValidationError(
      "Duplicate player within the same entry",
      "ENTRY_DUPLICATE_MEMBER",
    );
  }

  const positions = members.map((m) => m.position);
  if (new Set(positions).size !== positions.length) {
    throw new ValidationError(
      "Duplicate member position within the same entry",
      "ENTRY_DUPLICATE_POSITION",
    );
  }
}
