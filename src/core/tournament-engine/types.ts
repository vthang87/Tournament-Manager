/** Shared result envelope for tournament-engine pure functions. */

export type EngineWarning = {
  code: string;
  message: string;
  entityIds?: string[];
};

export type EngineResult<T> = {
  data: T;
  warnings: EngineWarning[];
};
