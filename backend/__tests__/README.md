# Test Suite

Comprehensive testing for JalMitra's groundwater prediction system using property-based testing and unit tests.

---

## 📁 Structure

```
__tests__/
├── predictions/              # Prediction system tests
│   ├── predictions.test.js           # Core prediction logic
│   ├── future-predictions.property.test.js
│   ├── seasonal-predictions.property.test.js
│   ├── stress-transitions.property.test.js
│   ├── error-handling.property.test.js
│   ├── cache-*.test.js               # Cache integration tests
│   ├── performance*.test.js          # Performance benchmarks
│   ├── edge-cases.test.js            # Edge case validation
│   └── integration*.test.js          # End-to-end tests
│
└── utils/                    # Test utilities
    ├── generators.js         # Fast-check data generators
    ├── testHelpers.js        # Helper functions
    ├── confidence.test.js    # Confidence scoring tests
    ├── statistics.test.js    # Statistical utilities tests
    └── validation.test.js    # Input validation tests
```

---

## 🧪 Testing Approach

### Property-Based Testing (2000+ test cases)

Uses **fast-check** to validate universal properties across randomly generated inputs.

**Benefits:**
- Catches edge cases that manual tests miss
- Validates correctness guarantees
- Tests with realistic data distributions

### Unit Testing

Traditional tests for specific scenarios and boundary conditions.

**Benefits:**
- Tests concrete examples
- Easy to debug failures
- Documents expected behavior

---

## 🚀 Running Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 📊 Test Coverage

- **100% coverage** of prediction logic
- **2000+ property-based test cases**
- **Edge cases**: minimum data, invalid inputs, boundary conditions
- **Performance**: response time, memory usage, cache efficiency
- **Integration**: end-to-end API workflows

---

## 🔧 Test Utilities

### Generators (`utils/generators.js`)

Smart generators for realistic groundwater data:

```javascript
historicalDataGenerator()      // Sorted water level history
rechargePatternGenerator()     // Seasonal recharge patterns
stressCategoryGenerator()      // Valid stress categories
declineRateGenerator()         // Realistic decline rates
predictionInputGenerator()     // Complete prediction inputs
```

### Helpers (`utils/testHelpers.js`)

Validation and utility functions:

```javascript
validatePredictionStructure()  // Check response format
isValidWaterLevel()            // Range validation
createMockHistoricalData()     // Generate test data
```

---

## ✍️ Writing Tests

### Property Test Example

```javascript
import fc from 'fast-check';
import { historicalDataGenerator } from '../utils/generators.js';

test('predictions always contain years 1, 2, 3, 5', () => {
  fc.assert(
    fc.property(
      historicalDataGenerator({ minLength: 3 }),
      (history) => {
        const result = computeFutureWaterLevels(history, 0.5, 10, new Date());
        const years = result.predictions.map(p => p.year);
        return [1, 2, 3, 5].every(y => years.includes(y));
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Example

```javascript
test('handles minimum data threshold (3 points)', () => {
  const history = createMockHistoricalData(3);
  const result = computeFutureWaterLevels(history, 0.5, 10, new Date());
  
  expect(result.predictions).toHaveLength(4);
  expect(result.confidence).toBe('low');
});
```

---

## ⚙️ Configuration

Jest config in `package.json`:
- ES modules support
- Node environment
- Coverage from `utils/` and `routes/`
- Test patterns: `**/*.test.js`
