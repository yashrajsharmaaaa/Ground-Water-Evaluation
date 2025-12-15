/**
 * App color palette for light and dark modes
 * Used throughout the app for consistent theming
 */

const tintColorLight = '#007AFF';
const tintColorDark = '#0A84FF';

export const Colors = {
  light: {
    // Base colors
    text: '#1F2937',
    textSecondary: '#6B7280',
    background: '#F9FAFB',
    backgroundCard: '#FFFFFF',
    tint: tintColorLight,
    
    // UI elements
    border: '#E5E7EB',
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    
    // Status colors
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    info: '#007AFF',
    
    // Water status colors
    safe: '#16A34A',
    semiCritical: '#D97706',
    critical: '#EA580C',
    overExploited: '#DC2626',
    
    // Input fields
    inputBackground: '#F3F4F6',
    inputBorder: '#D1D5DB',
    inputText: '#1F2937',
    placeholder: '#9CA3AF',
  },
  dark: {
    // Base colors
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    background: '#111827',
    backgroundCard: '#1F2937',
    tint: tintColorDark,
    
    // UI elements
    border: '#374151',
    icon: '#9CA3AF',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    
    // Status colors (slightly brighter for dark mode)
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#0A84FF',
    
    // Water status colors
    safe: '#22C55E',
    semiCritical: '#F59E0B',
    critical: '#FB923C',
    overExploited: '#EF4444',
    
    // Input fields
    inputBackground: '#374151',
    inputBorder: '#4B5563',
    inputText: '#F9FAFB',
    placeholder: '#6B7280',
  },
};
