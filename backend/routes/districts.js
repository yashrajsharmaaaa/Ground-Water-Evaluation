import { Router } from "express";
import { ALL_DISTRICTS, DISTRICTS_BY_STATE, STATES, STATS } from "../data/districts/index.js";
import { districtCache } from "../utils/cache.js";

const router = Router();

// Get all districts with optional state filter
// GET /api/districts?state=Rajasthan
router.get("/", (req, res) => {
  try {
    const { state } = req.query;
    
    // Check cache first
    const cacheKey = state ? `districts-${state}` : 'districts-all';
    const cached = districtCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    
    let districts;
    if (state && DISTRICTS_BY_STATE[state]) {
      districts = DISTRICTS_BY_STATE[state];
    } else if (state) {
      return res.status(400).json({ 
        error: "Invalid state",
        availableStates: STATES 
      });
    } else {
      districts = ALL_DISTRICTS;
    }
    
    const response = {
      total: districts.length,
      districts: districts,
      states: state ? [state] : STATES,
      coverage: {
        totalDistricts: STATS.totalDistricts,
        totalStates: STATS.totalStates,
        waterStressedStates: 12, // Core water-stressed states (product focus)
        note: "Includes 15 states total, focusing on 12 most water-stressed"
      }
    };
    
    // Cache for 24 hours (district data doesn't change)
    districtCache.set(cacheKey, response, 86400);
    
    res.json(response);
  } catch (error) {
    console.error("❌ Districts endpoint error:", error);
    res.status(500).json({ 
      error: "Failed to fetch districts",
      detail: error.message 
    });
  }
});

// Get statistics about district coverage
// GET /api/districts/stats
router.get("/stats", (req, res) => {
  try {
    const cacheKey = 'districts-stats';
    const cached = districtCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    
    const response = {
      ...STATS,
      waterStressedStates: [
        'Rajasthan', 'Gujarat', 'Maharashtra', 'Uttar Pradesh',
        'Madhya Pradesh', 'Karnataka', 'Tamil Nadu', 'Telangana',
        'Andhra Pradesh', 'Punjab', 'Haryana', 'Delhi'
      ],
      coverage: "70%+ of India's groundwater depletion regions"
    };
    
    // Cache for 24 hours
    districtCache.set(cacheKey, response, 86400);
    
    res.json(response);
  } catch (error) {
    console.error("❌ Districts stats error:", error);
    res.status(500).json({ 
      error: "Failed to fetch statistics",
      detail: error.message 
    });
  }
});

export default router;
