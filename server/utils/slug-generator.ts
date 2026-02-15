/**
 * Generate URL-friendly slug from a string
 * Converts to lowercase, removes special characters, replaces spaces with hyphens
 * @param text - Text to convert to slug
 * @returns URL-friendly slug
 */
export function generateSlug(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    // Replace Cyrillic and special characters with Latin equivalents or remove them
    .replace(/[ё]/g, 'yo')
    .replace(/[а]/g, 'a')
    .replace(/[б]/g, 'b')
    .replace(/[в]/g, 'v')
    .replace(/[г]/g, 'g')
    .replace(/[д]/g, 'd')
    .replace(/[е]/g, 'e')
    .replace(/[ж]/g, 'zh')
    .replace(/[з]/g, 'z')
    .replace(/[и]/g, 'i')
    .replace(/[й]/g, 'y')
    .replace(/[к]/g, 'k')
    .replace(/[л]/g, 'l')
    .replace(/[м]/g, 'm')
    .replace(/[н]/g, 'n')
    .replace(/[о]/g, 'o')
    .replace(/[п]/g, 'p')
    .replace(/[р]/g, 'r')
    .replace(/[с]/g, 's')
    .replace(/[т]/g, 't')
    .replace(/[у]/g, 'u')
    .replace(/[ф]/g, 'f')
    .replace(/[х]/g, 'h')
    .replace(/[ц]/g, 'ts')
    .replace(/[ч]/g, 'ch')
    .replace(/[ш]/g, 'sh')
    .replace(/[щ]/g, 'sch')
    .replace(/[ъ]/g, '')
    .replace(/[ы]/g, 'y')
    .replace(/[ь]/g, '')
    .replace(/[э]/g, 'e')
    .replace(/[ю]/g, 'yu')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all other special characters except hyphens
    .replace(/[^\w-]/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate if a string is a valid slug
 * @param slug - Slug to validate
 * @returns true if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0 || slug.length > 255) {
    return false;
  }
  
  // Slug should only contain lowercase letters, numbers, and hyphens
  // Should not start or end with hyphen
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
