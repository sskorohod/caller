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

// NANP area codes that are +1 but NOT the United States: Canada and the
// Caribbean / Atlantic countries (the latter are a classic toll-fraud target).
const NON_US_NANP_AREA_CODES = new Set([
  // Canada
  '204', '226', '236', '249', '250', '257', '263', '289', '306', '343', '354', '365', '367', '368', '382',
  '403', '416', '418', '428', '431', '437', '438', '450', '468', '474', '506', '514', '519', '548', '579',
  '581', '584', '587', '600', '604', '613', '622', '639', '647', '672', '683', '705', '709', '742', '753',
  '778', '780', '782', '807', '819', '825', '867', '873', '879', '902', '905', '942',
  // Caribbean / Atlantic
  '242', '246', '264', '268', '284', '345', '441', '473', '649', '658', '664', '721', '758', '767', '784',
  '809', '829', '849', '868', '869', '876',
]);

/** True only for a US number in E.164 form (+1, 10 digits, US area code). */
export function isUsPhone(e164: string): boolean {
  const m = /^\+1([2-9]\d{2})[2-9]\d{6}$/.exec(e164);
  return !!m && !NON_US_NANP_AREA_CODES.has(m[1]);
}
