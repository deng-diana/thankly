/**
 * Circle Service - 亲密圈 API 服务
 * 
 * 封装所有亲密圈相关的 API 请求
 */

import apiService from './apiService';
import {
  Circle,
  CircleMember,
  CircleFeedResponse,
  DiaryShareStatus,
  CreateCircleRequest,
  JoinCircleRequest,
  ShareDiaryRequest,
} from '../types/circle';

/**
 * Circle Management - 圈子管理
 */

/**
 * Create a new circle
 * 创建新圈子
 */
export const createCircle = async (circleName: string): Promise<Circle> => {
  const response = await apiService.post<Circle>('/circle', {
    circle_name: circleName,
  });
  return response;
};

/**
 * Join a circle via invite code
 * 通过邀请码加入圈子
 */
export const joinCircle = async (inviteCode: string): Promise<{ circle: Circle }> => {
  const response = await apiService.post<{ circle: Circle }>('/circle/join', {
    invite_code: inviteCode.toUpperCase(), // Normalize to uppercase
  });
  return response;
};

/**
 * Get user's circles
 * 获取用户的所有圈子
 */
export const getMyCircles = async (): Promise<Circle[]> => {
  const response = await apiService.get<Circle[]>('/circle/my-circles');
  return response;
};

/**
 * Get circle members
 * 获取圈子成员列表
 */
export const getCircleMembers = async (circleId: string): Promise<CircleMember[]> => {
  const response = await apiService.get<CircleMember[]>(`/circle/${circleId}/members`);
  return response;
};

/**
 * Leave a circle
 * 退出圈子
 */
export const leaveCircle = async (circleId: string): Promise<{ message: string }> => {
  const response = await apiService.delete<{ message: string }>(`/circle/${circleId}/leave`);
  return response;
};

/**
 * Circle Feed - 圈子动态流
 */

/**
 * Get circle feed with pagination
 * 获取圈子动态流（分页）
 * 
 * @param circleId - Circle ID
 * @param limit - Items per page (1-100, default 20)
 * @param lastKey - Pagination cursor from previous response
 */
export const getCircleFeed = async (
  circleId: string,
  limit: number = 20,
  lastKey?: string | null
): Promise<CircleFeedResponse> => {
  let url = `/circle/${circleId}/feed?limit=${limit}`;
  if (lastKey) {
    url += `&last_key=${encodeURIComponent(lastKey)}`;
  }
  
  const response = await apiService.get<CircleFeedResponse>(url);
  return response;
};

/**
 * Diary Sharing - 日记分享
 */

/**
 * Share a diary to a circle
 * 分享日记到圈子
 */
export const shareDiary = async (
  diaryId: string,
  circleId: string
): Promise<{ message: string; share: any }> => {
  const response = await apiService.post<{ message: string; share: any }>(
    `/diary/${diaryId}/share`,
    { circle_id: circleId }
  );
  return response;
};

/**
 * Unshare a diary from a circle
 * 取消分享日记
 */
export const unshareDiary = async (
  diaryId: string,
  circleId: string
): Promise<{ message: string; diary_id: string; circle_id: string }> => {
  const response = await apiService.delete<{ message: string; diary_id: string; circle_id: string }>(
    `/diary/${diaryId}/share/${circleId}`
  );
  return response;
};

/**
 * Get diary share status
 * 查询日记分享状态
 */
export const getDiaryShares = async (diaryId: string): Promise<DiaryShareStatus> => {
  const response = await apiService.get<DiaryShareStatus>(`/diary/${diaryId}/shares`);
  return response;
};

/**
 * Helper Functions
 */

/**
 * Validate invite code format
 * 验证邀请码格式（6位字母数字）
 */
export const validateInviteCodeFormat = (code: string): boolean => {
  const regex = /^[A-Z0-9]{6}$/i;
  return regex.test(code);
};

/**
 * Format invite code for display
 * 格式化邀请码显示（3-3分组）
 */
export const formatInviteCode = (code: string): string => {
  if (code.length === 6) {
    return `${code.substring(0, 3)} ${code.substring(3)}`;
  }
  return code;
};

/**
 * Error Handler Helper
 * 错误处理辅助函数
 */
export const handleCircleError = (error: any): string => {
  // Handle specific error codes
  if (error?.error_code) {
    switch (error.error_code) {
      case 'CIRCLE_LIMIT_EXCEEDED':
        return 'circle.errors.limitExceeded';
      case 'TOO_MANY_ATTEMPTS':
        return 'circle.errors.tooManyAttempts';
      case 'INVALID_CODE_FORMAT':
        return 'circle.errors.invalidCodeFormat';
      case 'INVITE_CODE_NOT_FOUND':
        return 'circle.errors.codeNotFound';
      case 'ALREADY_MEMBER':
        return 'circle.errors.alreadyMember';
      case 'OWNER_CANNOT_LEAVE':
        return 'circle.errors.ownerCannotLeave';
      case 'NOT_CIRCLE_MEMBER':
        return 'circle.errors.notMember';
      case 'DIARY_ALREADY_SHARED':
        return 'circle.errors.alreadyShared';
      default:
        return 'common.error';
    }
  }
  
  // Handle HTTP status codes
  if (error?.status) {
    switch (error.status) {
      case 403:
        return 'circle.errors.forbidden';
      case 404:
        return 'circle.errors.notFound';
      case 429:
        return 'circle.errors.tooManyAttempts';
      default:
        return 'common.error';
    }
  }
  
  return 'common.error';
};

export default {
  createCircle,
  joinCircle,
  getMyCircles,
  getCircleMembers,
  leaveCircle,
  getCircleFeed,
  shareDiary,
  unshareDiary,
  getDiaryShares,
  validateInviteCodeFormat,
  formatInviteCode,
  handleCircleError,
};
