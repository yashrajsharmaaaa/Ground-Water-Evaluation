/**
 * Circuit Breaker for External API Calls
 * Prevents cascade failures when WRIS API is down
 * 
 * How it works:
 * 1. Tracks failures for each API endpoint
 * 2. Opens circuit after threshold failures (default: 5)
 * 3. Blocks requests while circuit is open (default: 60s)
 * 4. Attempts to close circuit after timeout
 * 5. Falls back to cache if available
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5; // failures before opening
    this.timeout = options.timeout || 60000; // 60 seconds
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    
    // Track state per endpoint
    this.circuits = new Map();
  }

  /**
   * Get or create circuit state for endpoint
   */
  getCircuit(endpoint) {
    if (!this.circuits.has(endpoint)) {
      this.circuits.set(endpoint, {
        failures: 0,
        lastFailure: null,
        isOpen: false,
        successCount: 0
      });
    }
    return this.circuits.get(endpoint);
  }

  /**
   * Check if circuit is open for endpoint
   */
  isOpen(endpoint) {
    const circuit = this.getCircuit(endpoint);
    
    if (!circuit.isOpen) {
      return false;
    }

    // Check if timeout has passed
    const timeSinceFailure = Date.now() - circuit.lastFailure;
    if (timeSinceFailure >= this.timeout) {
      // Try to close circuit (half-open state)
      console.log(`🔄 Circuit breaker half-open for ${endpoint}`);
      circuit.isOpen = false;
      circuit.successCount = 0;
      return false;
    }

    return true;
  }

  /**
   * Record successful call
   */
  recordSuccess(endpoint) {
    const circuit = this.getCircuit(endpoint);
    circuit.failures = 0;
    circuit.successCount++;
    
    // Fully close circuit after successful calls
    if (circuit.successCount >= 2) {
      circuit.isOpen = false;
      console.log(`✅ Circuit breaker closed for ${endpoint}`);
    }
  }

  /**
   * Record failed call
   */
  recordFailure(endpoint) {
    const circuit = this.getCircuit(endpoint);
    circuit.failures++;
    circuit.lastFailure = Date.now();
    circuit.successCount = 0;

    if (circuit.failures >= this.threshold) {
      circuit.isOpen = true;
      console.error(`🚨 Circuit breaker opened for ${endpoint} (${circuit.failures} failures)`);
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(endpoint, fn, fallback = null) {
    // Check if circuit is open
    if (this.isOpen(endpoint)) {
      const circuit = this.getCircuit(endpoint);
      const timeRemaining = Math.ceil((this.timeout - (Date.now() - circuit.lastFailure)) / 1000);
      
      console.warn(`⚠️ Circuit breaker open for ${endpoint} (${timeRemaining}s remaining)`);
      
      // Try fallback if available
      if (fallback) {
        console.log(`🔄 Using fallback for ${endpoint}`);
        return await fallback();
      }
      
      throw new Error(`Service temporarily unavailable. Circuit breaker open for ${endpoint}. Retry in ${timeRemaining}s.`);
    }

    try {
      const result = await fn();
      this.recordSuccess(endpoint);
      return result;
    } catch (error) {
      this.recordFailure(endpoint);
      
      // Try fallback on failure
      if (fallback) {
        console.log(`🔄 Primary failed, using fallback for ${endpoint}`);
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed for ${endpoint}`);
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

  /**
   * Get circuit breaker stats
   */
  getStats() {
    const stats = {};
    for (const [endpoint, circuit] of this.circuits.entries()) {
      stats[endpoint] = {
        failures: circuit.failures,
        isOpen: circuit.isOpen,
        lastFailure: circuit.lastFailure ? new Date(circuit.lastFailure).toISOString() : null
      };
    }
    return stats;
  }

  /**
   * Reset all circuits (for testing)
   */
  reset() {
    this.circuits.clear();
  }
}

// Export singleton instance
export const circuitBreaker = new CircuitBreaker({
  threshold: 5,
  timeout: 60000, // 1 minute
  resetTimeout: 30000 // 30 seconds
});

export default CircuitBreaker;
