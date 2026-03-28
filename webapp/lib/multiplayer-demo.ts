import type { MpSession } from "./multiplayer-session";
import type { RoomState } from "./multiplayer-types";

const DEMO_HOST_PLACEHOLDER = "demo-host-placeholder";

export function randomShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function isoNow() {
  return new Date().toISOString();
}

export function demoCreateRoom(displayName: string): {
  session: MpSession;
  roomState: RoomState;
} {
  const shortCode = randomShortCode();
  const roomId = crypto.randomUUID();
  const hostPid = crypto.randomUUID();
  const name = displayName.trim() || "Host";
  const session: MpSession = {
    room_id: roomId,
    short_code: shortCode,
    invite_token: `demo_invite_${roomId}`,
    host_secret: `demo_hs_${roomId}`,
    host_player_token: `demo_hpt_${roomId}`,
    host_player_id: hostPid,
    role: "host",
    display_name: name,
  };
  const t = isoNow();
  const roomState: RoomState = {
    room: { id: roomId, short_code: shortCode, status: "open", created_at: t },
    you: {
      id: hostPid,
      role: "host",
      display_name: name,
      last_seen_at: t,
    },
    players: [
      {
        id: hostPid,
        role: "host",
        display_name: name,
        last_seen_at: t,
        joined_at: t,
      },
    ],
    latest_round: null,
  };
  return { session, roomState };
}

export function demoJoinByCode(
  code: string,
  displayName: string,
): { session: MpSession; roomState: RoomState } {
  const roomId = `demo-${code}`;
  const guestPid = crypto.randomUUID();
  const name = displayName.trim() || "Guest";
  const t = isoNow();
  const session: MpSession = {
    room_id: roomId,
    short_code: code,
    role: "guest",
    display_name: name,
    guest_player_token: `demo_gpt_${guestPid}`,
    guest_player_id: guestPid,
  };
  const roomState: RoomState = {
    room: { id: roomId, short_code: code, status: "open", created_at: t },
    you: {
      id: guestPid,
      role: "guest",
      display_name: name,
      last_seen_at: t,
    },
    players: [
      {
        id: DEMO_HOST_PLACEHOLDER,
        role: "host",
        display_name: "Host (preview)",
        last_seen_at: t,
        joined_at: t,
      },
      {
        id: guestPid,
        role: "guest",
        display_name: name,
        last_seen_at: t,
        joined_at: t,
      },
    ],
    latest_round: null,
  };
  return { session, roomState };
}

export function demoJoinSecondPlayer(
  hostSession: MpSession,
  prev: RoomState,
  displayName: string,
): { session: MpSession; roomState: RoomState } {
  const guestPid = crypto.randomUUID();
  const guestTok = `demo_gpt_${guestPid}`;
  const session: MpSession = {
    ...hostSession,
    guest_player_token: guestTok,
    guest_player_id: guestPid,
  };
  const t = isoNow();
  const guestName = displayName.trim() || "Guest2";
  const players = [...prev.players];
  players.push({
    id: guestPid,
    role: "guest",
    display_name: guestName,
    last_seen_at: t,
    joined_at: t,
  });
  return {
    session,
    roomState: { ...prev, players },
  };
}

export function demoStartRound(session: MpSession, prev: RoomState): RoomState {
  const candidates = [session.host_player_id, session.guest_player_id].filter(
    Boolean,
  ) as string[];
  const victim =
    candidates[Math.floor(Math.random() * candidates.length)] ??
    session.host_player_id!;
  const roundId = crypto.randomUUID();
  const t = isoNow();
  const nextIndex = (prev.latest_round?.round_index ?? 0) + 1;
  return {
    ...prev,
    latest_round: {
      id: roundId,
      round_index: nextIndex,
      victim_player_id: victim,
      deed: {
        type: "demo_dare",
        params: {
          hint: "Preview only — add Supabase keys for a real synced room.",
        },
      },
      status: "assigned",
      created_at: t,
      completed_at: null,
    },
  };
}

export function demoSubmitResult(
  prev: RoomState,
  result: "ok" | "skipped" | "error",
  detail: string,
): RoomState {
  const lr = prev.latest_round;
  if (!lr) return prev;
  return {
    ...prev,
    latest_round: {
      ...lr,
      status: "completed",
      result_status: result,
      result_detail: detail,
      completed_at: isoNow(),
    },
  };
}

/** Restore minimal room UI from saved demo session (round state not persisted). */
export function demoRoomStateFromSession(s: MpSession): RoomState {
  const t = isoNow();
  const code = s.short_code || "······";
  const players: RoomState["players"] = [];

  if (s.host_player_id) {
    players.push({
      id: s.host_player_id,
      role: "host",
      display_name: s.role === "host" ? s.display_name : "Host",
      last_seen_at: t,
      joined_at: t,
    });
  }
  if (s.guest_player_id) {
    players.push({
      id: s.guest_player_id,
      role: "guest",
      display_name:
        s.role === "guest" && !s.host_secret ? s.display_name : "Guest",
      last_seen_at: t,
      joined_at: t,
    });
  }

  if (s.role === "guest" && !s.host_player_id) {
    players.unshift({
      id: DEMO_HOST_PLACEHOLDER,
      role: "host",
      display_name: "Host (preview)",
      last_seen_at: t,
      joined_at: t,
    });
  }

  const youId =
    s.role === "host" ? s.host_player_id! : s.guest_player_id!;

  return {
    room: { id: s.room_id, short_code: code, status: "open", created_at: t },
    you: {
      id: youId,
      role: s.role,
      display_name: s.display_name,
      last_seen_at: t,
    },
    players,
    latest_round: null,
  };
}
