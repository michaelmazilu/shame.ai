export interface IGProfile {
  id: string;
  username: string;
  fullName?: string;
  bio?: string;
  profilePic?: string;
  followers?: number;
  following?: number;
  postCount?: number;
  isPrivate?: boolean;
  isVerified?: boolean;
  isBusiness?: boolean;
  isProfessional?: boolean;
  categoryName?: string | null;
  pronouns?: string[];
  externalUrl?: string | null;
  mutualFollowers?: number;
  mutualFollowerNames?: string[];
  followedByViewer?: boolean;
  followsViewer?: boolean;
  highlightReelCount?: number;
  isJoinedRecently?: boolean;
  recentPosts?: IGPost[];
}

export interface IGPost {
  id: string;
  mediaType: number;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  playCount: number;
  takenAt: number;
  location: {
    name: string;
    city?: string;
    lat?: number;
    lng?: number;
  } | null;
  usertags: { username: string; id: string }[];
  musicMetadata: { title: string; artist: string } | null;
  isPaidPartnership: boolean;
  productType: string | null;
  coauthors: { username: string; id: string }[];
}

export interface IGSession {
  cookies: string;
  csrfToken: string;
  userId: string;
  username: string;
  fbDtsg?: string;
  lsd?: string;
}

export interface Settings {
  enabled: boolean;
  dmTemplate: string;
  maxDMsPerHour: number;
  aiTone: "casual" | "flirty" | "witty" | "professional";
  sources: {
    suggested: boolean;
    explore: boolean;
    friendsOfFriends: boolean;
  };
}

export interface ShotHistoryEntry {
  profile: { id: string; username: string; fullName?: string };
  timestamp: number;
}

export interface PendingFollow {
  userId: string;
  username: string;
  fullName?: string;
  followedAt: number;
  dmTemplate: string;
  status: "pending" | "sent" | "expired";
  retries: number;
}
