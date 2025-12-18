/**
 * Shared API Types - Contract between Frontend and Backend
 * Prevents frontend/backend drift by defining shared interfaces
 */

// ============= REQUEST TYPES =============

export interface WaterLevelRequest {
  lat: number;
  lon: number;
  date: string; // ISO 8601 format: YYYY-MM-DD
}

export interface ChatRequest {
  message: string;
  lat?: number;
  lon?: number;
  date?: string;
  context?: any | false;
  language?: 'english' | 'hindi';
  district?: string;
}

export interface AuthRegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

// ============= RESPONSE TYPES =============

export interface StandardError {
  error: string;
  detail?: string;
  timestamp?: string;
}

export interface UserLocation {
  lat: number;
  lon: number;
  date: string;
}

export interface NearestStation {
  stationName: string;
  latitude: number;
  longitude: number;
  distanceKm: string;
  wellType: string;
  wellDepth: number | null;
  wellAquiferType: string;
  note?: string | null;
}

export interface HistoricalLevel {
  date: string;
  waterLevel: string;
}

export interface RechargePattern {
  year: number;
  preMonsoonDepth: string;
  postMonsoonDepth: string;
  rechargeAmount: string;
}

export interface RechargeTrend {
  annualChange: string;
  description: string;
  note?: string;
}

export interface StressAnalysis {
  trend: string;
  annualDeclineRate: string;
  preMonsoonDeclineRate: string | null;
  postMonsoonDeclineRate: string | null;
  category: string;
  note?: string;
}

export interface FuturePrediction {
  year: number;
  date: string;
  predictedLevel: number;
  unit: string;
}

export interface FutureWaterLevels {
  methodology: string;
  dataRange: {
    start: string;
    end: string;
  };
  predictions: FuturePrediction[];
  confidence?: 'high' | 'medium' | 'low';
}

export interface StressCategoryTransition {
  currentCategory: string;
  currentDeclineRate: number;
  thresholds: Record<string, { max?: number; min?: number }>;
  predictions: {
    nextCategory: string | null;
    yearsUntilTransition: number | null;
    estimatedTransitionDate: string | null;
    message?: string;
    warning?: string;
    trend?: string;
  } | null;
}

export interface SeasonalPrediction {
  season: string;
  period: string;
  predictedLevel: number;
  historicalAverage: number;
  expectedRecharge: number;
  unit: string;
}

export interface SeasonalPredictions {
  methodology: string;
  currentSeason: string;
  nextSeason: SeasonalPrediction;
  followingSeason: SeasonalPrediction;
  confidence?: 'high' | 'medium' | 'low';
}

export interface PredictionError {
  type: string;
  message: string;
  affectedPredictions: string[];
}

export interface Predictions {
  futureWaterLevels?: FutureWaterLevels;
  stressCategoryTransition?: StressCategoryTransition;
  seasonalPredictions?: SeasonalPredictions;
  errors?: PredictionError[];
}

export interface WaterLevelResponse {
  userLocation: UserLocation;
  nearestStation: NearestStation;
  currentWaterLevel: string | null;
  historicalLevels: HistoricalLevel[];
  rechargePattern: RechargePattern[];
  rechargeTrend: RechargeTrend | null;
  stressAnalysis: StressAnalysis;
  plotData: {
    historicalWaterLevels: Array<{ date: string; waterLevel: string }>;
    rechargePattern: Array<{ year: number; recharge: number }>;
    prePostMonsoon: Array<{ year: number; pre: number; post: number }>;
  };
  predictions: Predictions;
  cached?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences?: {
    language: string;
    notifications: boolean;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ChatResponse {
  response: string;
  meta?: {
    usedApi: boolean;
    apiSummary: any;
    finalDistrict: string | null;
    effectiveLat: number | null;
    effectiveLon: number | null;
    analysisRaw: any;
  };
}
