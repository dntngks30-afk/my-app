/**
 * Pose Guide 관련 타입 정의
 */

export type MediaKind = 'gif' | 'image' | 'video';

export interface Media {
  kind: MediaKind;
  src: string;
  alt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  tip: string;
}

export interface CameraConfig {
  facingMode: 'user' | 'environment';
  mirror: boolean;
  recommendedDistanceText: string;
  framingHint: string;
}

export interface PoseGuide {
  id: string;
  title: string;
  intent: string;
  durationSec: number;
  prepCountdownSec: number;
  instructions: string[];
  checklist: ChecklistItem[];
  media: Media;
  camera: CameraConfig;
  safetyNotes?: string[];
}
