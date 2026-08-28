/**
 * Real-time password strength evaluation for the Change Password / Reset
 * Password forms. Pure, stateless function — same "single source of truth
 * pulled out of a component" convention as role-home.ts — so any form that
 * collects a new password can reuse it without duplicating the rules.
 *
 * Mirrors (but does not replace) the backend's authoritative check in
 * app/schemas/common.py::validate_password_strength — the same 5 criteria
 * are evaluated here purely for live UI feedback. The backend validator is
 * still what actually accepts/rejects the password; this can never be the
 * only gate.
 */

export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'excellent';

export interface PasswordStrengthCriteria {
  minLength: boolean;   // >= 8 characters
  uppercase: boolean;   // [A-Z]
  lowercase: boolean;   // [a-z]
  digit: boolean;       // [0-9]
  specialChar: boolean; // [!@#$%^&*(),.?":{}|<>]
}

export interface PasswordStrengthResult {
  /** 0-5, how many of the 5 criteria below are satisfied. */
  score: number;
  /** 0-100, for a progress bar's [style.width.%] / [value]. */
  percent: number;
  level: PasswordStrengthLevel;
  label: string;
  /** Tailwind-friendly hex for the bar fill / text color. */
  color: string;
  criteria: PasswordStrengthCriteria;
}

const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const DIGIT_RE = /[0-9]/;
const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>]/;

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Evaluates a candidate password against the 5 backend-mirrored criteria
 * and returns a score/percent/level ready to drive a progress bar.
 *
 * Score bands (0-5 criteria met -> level):
 *   0-1 -> weak       (red)
 *   2-3 -> fair        (yellow)
 *   4   -> good         (light green)
 *   5   -> excellent    (dark green)
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const criteria: PasswordStrengthCriteria = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: UPPERCASE_RE.test(password),
    lowercase: LOWERCASE_RE.test(password),
    digit: DIGIT_RE.test(password),
    specialChar: SPECIAL_CHAR_RE.test(password),
  };

  const score = Object.values(criteria).filter(Boolean).length;
  const percent = password.length === 0 ? 0 : Math.round((score / 5) * 100);

  let level: PasswordStrengthLevel;
  let label: string;
  let color: string;

  if (password.length === 0 || score <= 1) {
    level = 'weak';
    label = 'Weak';
    color = '#dc2626'; // red-600
  } else if (score <= 3) {
    level = 'fair';
    label = 'Fair';
    color = '#eab308'; // yellow-500
  } else if (score === 4) {
    level = 'good';
    label = 'Good';
    color = '#84cc16'; // light green (lime-500)
  } else {
    level = 'excellent';
    label = 'Excellent';
    color = '#15803d'; // dark green (green-700)
  }

  return { score, percent, level, label, color, criteria };
}
