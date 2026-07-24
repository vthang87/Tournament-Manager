import type { User, UserRole } from "@/core/domain";

export type UserRepository = {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
};

export type { User, UserRole };
