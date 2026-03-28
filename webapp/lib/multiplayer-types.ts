export type RoomState = {
  room: { id: string; short_code: string; status: string; created_at: string };
  you: {
    id: string;
    role: string;
    display_name: string | null;
    last_seen_at: string;
  };
  players: Array<{
    id: string;
    role: string;
    display_name: string | null;
    last_seen_at: string;
    joined_at: string;
  }>;
  latest_round: {
    id: string;
    round_index: number;
    victim_player_id: string;
    deed: { type: string; params: Record<string, unknown>; template_id?: string };
    status: string;
    result_status?: string | null;
    result_detail?: string | null;
    created_at: string;
    completed_at?: string | null;
  } | null;
};
