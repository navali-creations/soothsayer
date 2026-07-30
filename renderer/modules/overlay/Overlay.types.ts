import type {
  OverlayRecentDropDTO,
  OverlaySessionCardDTO,
  OverlaySessionDataDTO,
} from "~/main/modules/overlay/Overlay.dto";

export type CardEntry = OverlaySessionCardDTO;
export type RecentDrop = OverlayRecentDropDTO;
export type SessionData = OverlaySessionDataDTO;

export type OverlayTab = "all" | "valuable";
