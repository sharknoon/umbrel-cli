/**
 * Checks if a given URL is valid.
 * 
 * @param url - The URL to validate.
 * @returns `true` if the URL is valid, `false` otherwise.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}
