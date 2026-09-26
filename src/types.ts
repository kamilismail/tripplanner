import type { Database } from "@/db/database.types";

export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type TripPoint = Database["public"]["Tables"]["trip_points"]["Row"];
