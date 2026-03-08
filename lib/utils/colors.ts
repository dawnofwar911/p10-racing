/**
 * Determines if black or white text should be used on a given hex background color
 * for optimal readability.
 */
export function getContrastColor(hexcolor: string): 'black' | 'white' {
  // Remove the hash if it exists
  const hex = hexcolor.replace("#", "");
  
  // Convert 3-digit hex to 6-digits
  const fullHex = hex.length === 3 
    ? hex.split('').map(char => char + char).join('') 
    : hex;

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  
  // YIQ formula (higher value = lighter color)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  return (yiq >= 128) ? 'black' : 'white';
}
