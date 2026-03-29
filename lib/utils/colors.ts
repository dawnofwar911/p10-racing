import { TEAM_COLORS } from '../types';

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

/**
 * Converts a hex color to an RGBA string with the specified alpha.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generates a full theme palette based on a team ID.
 * Defaults to Formula 1 Red.
 */
export function getTeamPalette(teamId?: string | null) {
  const primary = (teamId && TEAM_COLORS[teamId]) || '#e10600';
  const contrast = getContrastColor(primary);
  
  return {
    primary,
    glow: hexToRgba(primary, 0.15),
    border: hexToRgba(primary, 0.3),
    contrast: contrast === 'white' ? '#ffffff' : '#000000'
  };
}
