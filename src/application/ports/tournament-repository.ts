import type {
  CreateTournamentEventInput,
  CreateTournamentInput,
  Tournament,
  TournamentEvent,
  TournamentStatus,
  UpdateTournamentEventInput,
  UpdateTournamentInput,
} from "@/core/domain";

export interface TournamentRepository {
  create(input: CreateTournamentInput): Promise<Tournament>;
  findById(id: string): Promise<Tournament | null>;
  findBySlug(slug: string): Promise<Tournament | null>;
  list(): Promise<Tournament[]>;
  update(
    id: string,
    input: UpdateTournamentInput,
  ): Promise<Tournament | null>;
  updateStatus(
    id: string,
    status: TournamentStatus,
  ): Promise<Tournament | null>;
}

export interface TournamentEventRepository {
  create(input: CreateTournamentEventInput): Promise<TournamentEvent>;
  findById(id: string): Promise<TournamentEvent | null>;
  listByTournamentId(tournamentId: string): Promise<TournamentEvent[]>;
  update(
    id: string,
    input: UpdateTournamentEventInput,
  ): Promise<TournamentEvent | null>;
  updateStatus(
    id: string,
    status: TournamentEvent["status"],
  ): Promise<TournamentEvent | null>;
}
