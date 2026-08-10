export const SPORT_IDS = {
  BADMINTON: "sport-badminton",
  PICKLEBALL: "sport-pickleball",
} as const;

export type SportId = (typeof SPORT_IDS)[keyof typeof SPORT_IDS];

export type Sport = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
