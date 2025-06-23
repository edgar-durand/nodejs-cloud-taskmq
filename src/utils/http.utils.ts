import { Request } from 'express';

/**
 * HTTP utility functions
 */

/**
 * Extract IP address from Express request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;
  const cloudFlareIp = req.headers['cf-connecting-ip'] as string;
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (cloudFlareIp) {
    return cloudFlareIp;
  }
  
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

/**
 * Check if request is from Google Cloud Tasks
 */
export function isCloudTasksRequest(req: Request): boolean {
  const taskName = req.headers['x-cloudtasks-taskname'];
  const queueName = req.headers['x-cloudtasks-queuename'];
  const userAgent = req.headers['user-agent'];
  
  // Check for Cloud Tasks headers
  if (taskName && queueName) {
    return true;
  }
  
  // Check for Cloud Tasks user agent
  if (userAgent && userAgent.includes('Google-Cloud-Tasks')) {
    return true;
  }
  
  return false;
}

/**
 * Validate Cloud Tasks request headers
 */
export function validateCloudTasksHeaders(req: Request): {
  valid: boolean;
  taskName?: string;
  queueName?: string;
  errors: string[];
} {
  const errors: string[] = [];
  const taskName = req.headers['x-cloudtasks-taskname'] as string;
  const queueName = req.headers['x-cloudtasks-queuename'] as string;
  const userAgent = req.headers['user-agent'] as string;
  
  if (!taskName) {
    errors.push('Missing x-cloudtasks-taskname header');
  }
  
  if (!queueName) {
    errors.push('Missing x-cloudtasks-queuename header');
  }
  
  if (!userAgent || !userAgent.includes('Google-Cloud-Tasks')) {
    errors.push('Invalid or missing user-agent header');
  }
  
  return {
    valid: errors.length === 0,
    taskName,
    queueName,
    errors,
  };
}

/**
 * Get request body size in bytes
 */
export function getRequestBodySize(req: Request): number {
  const contentLength = req.headers['content-length'];
  return contentLength ? parseInt(contentLength, 10) : 0;
}

/**
 * Check if request contains JSON
 */
export function isJsonRequest(req: Request): boolean {
  const contentType = req.headers['content-type'];
  return contentType ? contentType.includes('application/json') : false;
}

/**
 * Extract bearer token from Authorization header
 */
export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  
  const matches = authHeader.match(/^Bearer\s+(.+)$/i);
  return matches ? matches[1] : null;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  code?: string,
  details?: any,
): {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
  };
} {
  return {
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T = any>(
  data: T,
  message?: string,
): {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
} {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse query string parameters safely
 */
export function parseQueryParam(
  value: string | string[] | undefined,
  defaultValue?: string,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0] || defaultValue;
  }
  return value || defaultValue;
}

/**
 * Parse numeric query parameter
 */
export function parseNumericQueryParam(
  value: string | string[] | undefined,
  defaultValue?: number,
  min?: number,
  max?: number,
): number | undefined {
  const stringValue = parseQueryParam(value);
  if (!stringValue) {
    return defaultValue;
  }
  
  const numericValue = parseInt(stringValue, 10);
  if (isNaN(numericValue)) {
    return defaultValue;
  }
  
  let result = numericValue;
  
  if (min !== undefined && result < min) {
    result = min;
  }
  
  if (max !== undefined && result > max) {
    result = max;
  }
  
  return result;
}

/**
 * Parse boolean query parameter
 */
export function parseBooleanQueryParam(
  value: string | string[] | undefined,
  defaultValue?: boolean,
): boolean | undefined {
  const stringValue = parseQueryParam(value);
  if (!stringValue) {
    return defaultValue;
  }
  
  const lowerValue = stringValue.toLowerCase();
  if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
    return true;
  }
  
  if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
    return false;
  }
  
  return defaultValue;
}

/**
 * Parse array query parameter
 */
export function parseArrayQueryParam(
  value: string | string[] | undefined,
  separator = ',',
): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  
  if (!value) {
    return [];
  }
  
  return value.split(separator).map(item => item.trim()).filter(Boolean);
}

/**
 * Sanitize file name for safe usage
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
