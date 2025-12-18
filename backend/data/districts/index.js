/**
 * All India District Database - Water-Stressed States
 * Centralized district data for coordinate-to-district lookup
 * Focus: States with critical groundwater depletion issues
 */

import rajasthanDistricts from './rajasthan.json' with { type: 'json' };
import gujaratDistricts from './gujarat.json' with { type: 'json' };
import maharashtraDistricts from './maharashtra.json' with { type: 'json' };
import uttarPradeshDistricts from './uttar-pradesh.json' with { type: 'json' };
import madhyaPradeshDistricts from './madhya-pradesh.json' with { type: 'json' };
import karnatakaDistricts from './karnataka.json' with { type: 'json' };
import tamilNaduDistricts from './tamil-nadu.json' with { type: 'json' };
import telanganaDistricts from './telangana.json' with { type: 'json' };
import andhraDistricts from './andhra-pradesh.json' with { type: 'json' };
import punjabDistricts from './punjab.json' with { type: 'json' };
import haryanaDistricts from './haryana.json' with { type: 'json' };
import delhiDistricts from './delhi.json' with { type: 'json' };
import chhattisgarhDistricts from './chhattisgarh.json' with { type: 'json' };
import jharkhandDistricts from './jharkhand.json' with { type: 'json' };
import odishaDistricts from './odisha.json' with { type: 'json' };

// Combine all state districts into single array
export const ALL_DISTRICTS = [
  ...rajasthanDistricts,
  ...gujaratDistricts,
  ...maharashtraDistricts,
  ...uttarPradeshDistricts,
  ...madhyaPradeshDistricts,
  ...karnatakaDistricts,
  ...tamilNaduDistricts,
  ...telanganaDistricts,
  ...andhraDistricts,
  ...punjabDistricts,
  ...haryanaDistricts,
  ...delhiDistricts,
  ...chhattisgarhDistricts,
  ...jharkhandDistricts,
  ...odishaDistricts,
];

// Export by state for easy access
export const DISTRICTS_BY_STATE = {
  Rajasthan: rajasthanDistricts,
  Gujarat: gujaratDistricts,
  Maharashtra: maharashtraDistricts,
  'Uttar Pradesh': uttarPradeshDistricts,
  'Madhya Pradesh': madhyaPradeshDistricts,
  Karnataka: karnatakaDistricts,
  'Tamil Nadu': tamilNaduDistricts,
  Telangana: telanganaDistricts,
  'Andhra Pradesh': andhraDistricts,
  Punjab: punjabDistricts,
  Haryana: haryanaDistricts,
  Delhi: delhiDistricts,
  Chhattisgarh: chhattisgarhDistricts,
  Jharkhand: jharkhandDistricts,
  Odisha: odishaDistricts,
};

// Get all unique states
export const STATES = Object.keys(DISTRICTS_BY_STATE);

// Statistics
export const STATS = {
  totalDistricts: ALL_DISTRICTS.length,
  totalStates: STATES.length,
  districtsByState: Object.entries(DISTRICTS_BY_STATE).map(([state, districts]) => ({
    state,
    count: districts.length
  }))
};

console.log(`📍 Loaded ${STATS.totalDistricts} districts across ${STATS.totalStates} water-stressed states`);
