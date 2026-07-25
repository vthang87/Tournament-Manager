/** Shared result envelope for tournament-engine pure functions. */

export type EngineWarning = {
  code: string;
  message: string;
  entityIds?: string[];
  /** Group involved in the warning (when applicable). */
  groupId?: string;
  /** Club / team / region id, or expected group id for seed warnings. */
  attributeId?: string;
};

export type EngineResult<T> = {
  data: T;
  warnings: EngineWarning[];
};
