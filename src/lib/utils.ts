/**
 * Utility Functions
 * 
 * Common utilities used throughout the application
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

/**
 * Merge class names with Tailwind CSS conflict resolution
 * 
 * @example
 * cn("px-2 py-1", "px-4") // Returns: "py-1 px-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID
 * 
 * @param prefix - Optional prefix for the ID
 * @param length - Length of the random part (default: 12)
 */
export function generateId(prefix?: string, length = 12): string {
  const id = nanoid(length);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Format date in a human-readable format
 * 
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", options).format(d);
}

/**
 * Format date relative to now (e.g., "2 hours ago")
 * 
 * @param date - Date to format
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  } else if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  } else if (weeks < 4) {
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  } else if (months < 12) {
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  } else {
    return `${years} ${years === 1 ? "year" : "years"} ago`;
  }
}

/**
 * Format file size in human-readable format
 * 
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Format number with thousands separator
 * 
 * @param num - Number to format
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Truncate text with ellipsis
 * 
 * @param text - Text to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add (default: "...")
 */
export function truncate(text: string, length: number, suffix = "..."): string {
  if (text.length <= length) {
    return text;
  }
  return text.substring(0, length - suffix.length) + suffix;
}

/**
 * Slugify a string for URLs
 * 
 * @param text - Text to slugify
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

/**
 * Debounce a function
 * 
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(this: any, ...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function
 * 
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;

  return function executedFunction(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Copy text to clipboard
 * 
 * @param text - Text to copy
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Check if code is running on the client
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if code is running on the server
 */
export function isServer(): boolean {
  return !isClient();
}

/**
 * Get initials from a name
 * 
 * @param name - Full name
 */
export function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) {
    return parts[0]!.substring(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * Generate a random color for avatars
 * 
 * @param seed - Seed for consistent color
 */
export function generateColor(seed: string): string {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FECA57", // Yellow
    "#FF9FF3", // Pink
    "#54A0FF", // Light Blue
    "#48DBFB", // Sky Blue
    "#A29BFE", // Purple
    "#FD79A8", // Rose
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index]!;
}

/**
 * Parse JSON safely
 * 
 * @param json - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 */
export function parseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Create a query string from an object
 * 
 * @param params - Object to convert to query string
 */
export function createQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * Parse query string to object
 * 
 * @param queryString - Query string to parse
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * 
 * @param value - Value to check
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Retry a promise-based function
 * 
 * @param fn - Function to retry
 * @param retries - Number of retries
 * @param delay - Delay between retries in milliseconds
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

/**
 * Wait for a specified amount of time
 * 
 * @param ms - Milliseconds to wait
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format SQL query for display
 * 
 * @param sql - SQL query string
 */
export function formatSQL(sql: string): string {
  // Basic SQL formatting - in production, use a proper SQL formatter library
  return sql
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\s*,\s*/g, ",\n  ") // Format commas
    .replace(/\s+(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|GROUP BY|ORDER BY|HAVING|LIMIT)/gi, "\n$1")
    .replace(/\s+(AND|OR)\s+/gi, "\n  $1 ")
    .trim();
}