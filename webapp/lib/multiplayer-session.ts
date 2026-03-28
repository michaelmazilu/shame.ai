"use client";

const KEY = "shame_mp_session_v1";

export type MpRole = "host" | "guest";

export type MpSession = {
  room_id: string;
  short_code?: string;
  invite_token?: string;
  host_secret?: string;
  host_player_token?: string;
  host_player_id?: string;
  guest_player_token?: string;
  guest_player_id?: string;
  role: MpRole;
  display_name: string;
};

export function loadSession(): MpSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MpSession;
  } catch {
    return null;
  }
}

export function saveSession(s: MpSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

/** Token used for heartbeat / room-state / submit for *this* browser user */
export function myPlayerToken(s: MpSession): string | undefined {
  return s.role === "host" ? s.host_player_token : s.guest_player_token;
}

/**
 * Join flow: new guest, OR second identity on same device (host already in session).
 */
export function applyJoinToSession(
  prev: MpSession | null,
  join: {
    room_id: string;
    short_code?: string;
    player_token: string;
    player_id: string;
  },
  displayName: string,
): MpSession {
  if (prev?.host_secret && prev.room_id === join.room_id) {
    return {
      ...prev,
      guest_player_token: join.player_token,
      guest_player_id: join.player_id,
      short_code: join.short_code ?? prev.short_code,
    };
  }
  return {
    room_id: join.room_id,
    short_code: join.short_code,
    role: "guest",
    display_name: displayName,
    guest_player_token: join.player_token,
    guest_player_id: join.player_id,
  };
}

export function tokenForVictim(s: MpSession, victimPlayerId: string): string | undefined {
  if (s.host_player_id === victimPlayerId) return s.host_player_token;
  if (s.guest_player_id === victimPlayerId) return s.guest_player_token;
  return undefined;
}
