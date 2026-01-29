/**
 * Intimate Circle Feature - Type Definitions
 * 亲密圈功能 - 类型定义
 */

/**
 * Circle - 圈子
 */
export interface Circle {
  circle_id: string;
  circle_name: string;
  member_count: number;
  role: 'owner' | 'member';
  invite_code?: string; // Only visible to owner
  joined_at?: string; // ISO8601
  created_at: string; // ISO8601
}

/**
 * Circle Member - 圈子成员
 */
export interface CircleMember {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  role: 'owner' | 'member';
  joined_at: string; // ISO8601
}

/**
 * Shared Diary Item - 动态流中的日记项
 * (Denormalized for performance - 包含冗余字段)
 */
export interface CircleFeedItem {
  shareId: string;
  diaryId: string;
  circleId: string;
  userId: string;
  sharedAt: string; // ISO8601
  
  // Denormalized fields from diary and user
  userName: string;
  userAvatar?: string;
  diaryTitle: string;
  diaryPreview: string; // First 200 chars
  emotion: string;
  imageUrls: string[];
  hasAudio: boolean;
  diaryCreatedAt: string; // ISO8601
}

/**
 * Diary Share Status - 日记分享状态
 */
export interface DiaryShareStatus {
  diary_id: string;
  shared_to_circles: ShareRecord[];
  count: number;
}

export interface ShareRecord {
  circle_id: string;
  shared_at: string; // ISO8601
  share_id: string;
}

/**
 * API Request/Response Types
 */

// Create circle request
export interface CreateCircleRequest {
  circle_name: string;
}

// Join circle request
export interface JoinCircleRequest {
  invite_code: string;
}

// Share diary request
export interface ShareDiaryRequest {
  circle_id: string;
}

// Circle feed response
export interface CircleFeedResponse {
  circle_id: string;
  items: CircleFeedItem[];
  last_key: string | null; // Base64 encoded pagination cursor
  count: number;
}

/**
 * Error Response Types
 */
export interface CircleErrorResponse {
  error_code: string;
  message: string;
  retry_after?: number; // For rate limit errors (429)
}

/**
 * Common error codes
 */
export enum CircleErrorCode {
  CIRCLE_LIMIT_EXCEEDED = 'CIRCLE_LIMIT_EXCEEDED',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  INVALID_CODE_FORMAT = 'INVALID_CODE_FORMAT',
  INVITE_CODE_NOT_FOUND = 'INVITE_CODE_NOT_FOUND',
  ALREADY_MEMBER = 'ALREADY_MEMBER',
  OWNER_CANNOT_LEAVE = 'OWNER_CANNOT_LEAVE',
  NOT_CIRCLE_MEMBER = 'NOT_CIRCLE_MEMBER',
  DIARY_ALREADY_SHARED = 'DIARY_ALREADY_SHARED',
}

/**
 * UI State Types
 */

// Circle list filter
export type CircleFilter = 'all' | 'owned' | 'joined';

// Onboarding step
export type OnboardingStep = 'welcome' | 'create_or_join' | 'complete';
