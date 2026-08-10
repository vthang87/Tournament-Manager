/** Round-robin engine domain types. */

export type RoundRobinPair = {
  entryAId: string;
  entryBId: string;
};

export type RoundRobinRound = {
  roundNumber: number;
  pairs: RoundRobinPair[];
};

export type GenerateRoundRobinInput = {
  entryIds: string[];
};
