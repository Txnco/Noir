export type AuthState =
  | { status: "idle" }
  | { status: "error"; error: string; code?: string }
  | { status: "success"; message: string; redirectTo: string };

export const IDLE: AuthState = { status: "idle" };
