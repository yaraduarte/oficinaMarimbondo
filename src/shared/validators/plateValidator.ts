/**
 * Validates Brazilian vehicle plate formats:
 * - Old format: ABC-1234 (3 letters + 4 digits)
 * - Mercosul format: ABC1D23 (3 letters + 1 digit + 1 letter + 2 digits)
 */
export function validatePlate(plate: string): boolean {
  const cleaned = plate.replace(/[-\s]/g, '').toUpperCase();

  // Old format: 3 letters + 4 digits (e.g., ABC1234)
  const oldFormat = /^[A-Z]{3}\d{4}$/;

  // Mercosul format: 3 letters + 1 digit + 1 letter + 2 digits (e.g., ABC1D23)
  const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/;

  return oldFormat.test(cleaned) || mercosulFormat.test(cleaned);
}
