/**
 * WebIntel Auth Guard & Route Protection
 * Specifies protected modules vs public modules, and guards user actions.
 * Public modules may always analyze websites; protected modules require active authentication.
 */

import { sessionManager } from './session';

export const PROTECTED_MODULES = [
  'saved_analyses',
  'exports_history',
  'ai_reports',
  'subscription',
] as const;

export type ProtectedModuleKey = typeof PROTECTED_MODULES[number];

export const PUBLIC_MODULES = [
  'overview',
  'products',
  'seo',
  'tech_stack',
  'traffic',
] as const;

export type PublicModuleKey = typeof PUBLIC_MODULES[number];

/**
 * Checks if a specific feature module requires authentication.
 */
export function isModuleProtected(moduleKey: string): boolean {
  return PROTECTED_MODULES.includes(moduleKey as ProtectedModuleKey);
}

/**
 * Executes a callback if the user is authenticated, or triggers an auth requirement prompt.
 *
 * @param actionName Friendly description of the action (e.g. "Save Analysis", "Export History")
 * @param onSuccess Callback executed if user is authenticated
 * @param onAuthRequired Callback executed if user is logged out (e.g. opens Login modal)
 * @returns boolean true if action was executed immediately, false if auth is required
 */
export function requireAuth(
  actionName: string,
  onSuccess: () => void,
  onAuthRequired?: (actionName: string) => void
): boolean {
  if (sessionManager.isAuthenticated()) {
    onSuccess();
    return true;
  }

  if (onAuthRequired) {
    onAuthRequired(actionName);
  }
  return false;
}

/**
 * Checks whether cloud saving is currently available (requires logged_in state).
 */
export function canCloudSave(): boolean {
  return sessionManager.isAuthenticated();
}
