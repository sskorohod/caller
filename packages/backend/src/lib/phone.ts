/**
 * Normalize a phone number to E.164 format.
 * - Strips spaces, dashes, parentheses
 * - If 10 digits (US number without country code), prepends +1
 * - If starts with 1 and has 11 digits, prepends +
 * - Ensures result starts with +
 */
export function normalizePhone(raw: string): string {
  // Strip formatting characters
  let phone = raw.replace(/[\s\-\(\)\.\+]/g, '');

  // US number: 10 digits → prepend 1
  if (/^\d{10}$/.test(phone)) {
    phone = '1' + phone;
  }

  // 11 digits starting with 1 → US number
  // Other lengths → international, keep as-is

  return '+' + phone;
}
