/**
 * DEPRECATED: This file is kept for backward compatibility only
 * Use backend/data/districts/index.js instead
 * 
 * All district data has been moved to JSON files in backend/data/districts/
 * This provides better organization and easier maintenance
 */

import { ALL_DISTRICTS } from '../data/districts/index.js';

// Re-export for backward compatibility
export { ALL_DISTRICTS };

// Legacy export - kept for backward compatibility
export const RAJASTHAN_DISTRICTS = ALL_DISTRICTS.filter(d => d.state === 'Rajasthan');

// Get state name from district
export function getStateFromDistrict(districtName) {
  const district = ALL_DISTRICTS.find(
    d => d.name.toLowerCase() === districtName?.toLowerCase()
  );
  return district?.state || null;
}
