import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { Card, Chip, Searchbar } from "react-native-paper";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationName, setLocationName] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [groundwaterData, setGroundwaterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  // Backend API URL (replace with your ngrok URL)
  const API_BASE_URL = "https://1a2201527830.ngrok-free.app"; // Replace with actual ngrok URL

  // Hardcoded popular places with coordinates
  const POPULAR_PLACES = [
    { name: "Jaipur", lat: 26.91, lon: 75.79 },
    { name: "Jodhpur", lat: 26.24, lon: 73.02 },
    { name: "Udaipur", lat: 24.58, lon: 73.71 },
    { name: "Bikaner", lat: 28.02, lon: 73.31 },
    { name: "Ajmer", lat: 26.45, lon: 74.64 },
    { name: "Kota", lat: 25.18, lon: 75.83 },
    { name: "Alwar", lat: 27.56, lon: 76.60 },
    { name: "Bharatpur", lat: 27.22, lon: 77.50 },
    { name: "Sikar", lat: 27.61, lon: 75.14 },
    { name: "Pali", lat: 25.77, lon: 73.32 },
  ];

  // Fetch groundwater data from backend
  const fetchGroundwaterData = async (
    lat,
    lon,
    placeName,
    date = new Date().toISOString().split("T")[0]
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/water-levels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          date,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setGroundwaterData(data);
      setLocationName(placeName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch (err) {
      setError(err.message);
      Alert.alert(
        "Error",
        `Failed to fetch groundwater data: ${err.message}. Please check your network or try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  // Get current location and fetch data (fallback to Jaipur if location access fails)
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required. Defaulting to Jaipur.",
          [
            {
              text: "OK",
              onPress: () => {
                const defaultLocation = POPULAR_PLACES.find(
                  (place) => place.name === "Jaipur"
                );
                setCurrentLocation({
                  lat: defaultLocation.lat,
                  lon: defaultLocation.lon,
                });
                fetchGroundwaterData(
                  defaultLocation.lat,
                  defaultLocation.lon,
                  `${defaultLocation.name}, Rajasthan, India`
                );
              },
            },
          ]
        );
        return;
      }

      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Since reverse geocoding is removed, use closest popular place as fallback
      const closestPlace = POPULAR_PLACES.reduce((prev, curr) => {
        const prevDistance = Math.sqrt(
          Math.pow(prev.lat - location.coords.latitude, 2) +
            Math.pow(prev.lon - location.coords.longitude, 2)
        );
        const currDistance = Math.sqrt(
          Math.pow(curr.lat - location.coords.latitude, 2) +
            Math.pow(curr.lon - location.coords.longitude, 2)
        );
        return currDistance < prevDistance ? curr : prev;
      }, POPULAR_PLACES[0]);

      setCurrentLocation({
        lat: 26.833,
        lon: 75.583,
      });

      await fetchGroundwaterData(26.833, 75.583, "Jaipur, Rajasthan, India");
    } catch (err) {
      setError(err.message);
      Alert.alert(
        "Location Error",
        "Failed to get current location. Defaulting to Jaipur.",
        [
          {
            text: "OK",
            onPress: () => {
              const defaultLocation = POPULAR_PLACES.find(
                (place) => place.name === "Jaipur"
              );
              setCurrentLocation({
                lat: defaultLocation.lat,
                lon: defaultLocation.lon,
              });
              fetchGroundwaterData(
                defaultLocation.lat,
                defaultLocation.lon,
                `${defaultLocation.name}, Rajasthan, India`
              );
            },
          },
        ]
      );
      setLoading(false);
    }
  };

  // Handle place search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Input Required", "Please enter a place name (e.g., Jaipur, Udaipur)");
      return;
    }

    try {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const results = POPULAR_PLACES.filter((place) =>
        place.name.toLowerCase().includes(normalizedQuery)
      ).map((place) => ({
        name: `${place.name}, Rajasthan, India`,
        lat: place.lat,
        lon: place.lon,
      }));

      if (results.length === 0) {
        throw new Error(`No locations found for "${searchQuery}"`);
      }

      if (results.length === 1) {
        const location = results[0];
        await fetchGroundwaterData(location.lat, location.lon, location.name);
        setSuggestions([]);
      } else {
        setSuggestions(results);
      }
    } catch (err) {
      setError(err.message);
      Alert.alert("Search Error", err.message);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion) => {
    setSearchQuery(suggestion.name);
    setSuggestions([]);
    await fetchGroundwaterData(suggestion.lat, suggestion.lon, suggestion.name);
  };

  // Handle popular place selection
  const handlePopularPlaceSelect = async (placeName) => {
    setSearchQuery(placeName);
    setSuggestions([]);
    try {
      const location = POPULAR_PLACES.find((place) => place.name === placeName);
      if (!location) {
        throw new Error(`No coordinates found for "${placeName}"`);
      }
      await fetchGroundwaterData(
        location.lat,
        location.lon,
        `${location.name}, Rajasthan, India`
      );
    } catch (err) {
      setError(err.message);
      Alert.alert("Search Error", err.message);
    }
  };

  // Debounced suggestions
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.length >= 2) {
        getSuggestions(searchQuery);
      } else {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  // Get location suggestions as user types
  const getSuggestions = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const normalizedQuery = query.toLowerCase().trim();
      const results = POPULAR_PLACES.filter((place) =>
        place.name.toLowerCase().includes(normalizedQuery)
      ).map((place) => ({
        name: `${place.name}, Rajasthan, India`,
        lat: place.lat,
        lon: place.lon,
      }));
      setSuggestions(results.slice(0, 5));
    } catch (err) {
      setSuggestions([]);
    }
  };

  // Get status color based on water level trend
  const getStatusColor = () => {
    if (!groundwaterData?.stressAnalysis) return "#6B7280";

    const category = groundwaterData.stressAnalysis.category;
    switch (category) {
      case "Over-exploited":
        return "#DC2626";
      case "Critical":
        return "#EA580C";
      case "Semi-critical":
        return "#D97706";
      case "Safe":
        return "#16A34A";
      default:
        return "#6B7280";
    }
  };

  // Prepare data for recharge line chart
  const getRechargeLineData = () => {
    if (!groundwaterData?.rechargePattern || groundwaterData.rechargePattern.length === 0) {
      return { labels: [], datasets: [{ data: [] }] };
    }
    const labels = groundwaterData.rechargePattern.map((item) => item.year.toString().slice(-2)); // Show last 2 digits
    const data = groundwaterData.rechargePattern.map((item) => parseFloat(item.rechargeAmount));
    return {
      labels,
      datasets: [{ data }],
    };
  };

  // Prepare data for historical bar chart - Display ALL years from backend
  const getHistoricalBarData = () => {
    if (!groundwaterData?.historicalLevels || groundwaterData.historicalLevels.length === 0) {
      return { labels: [], datasets: [] };
    }
    // Display all data, don't slice to maintain all years
    const labels = groundwaterData.historicalLevels.map((item) => item.date.split("-")[0].slice(-2)); // Show last 2 digits of year
    const data = groundwaterData.historicalLevels.map((item) => parseFloat(item.waterLevel));
    return {
      labels,
      datasets: [{ data }],
    };
  };

  // Prepare data for trend analysis bar chart
  const getTrendBarData = () => {
    if (!groundwaterData?.stressAnalysis) {
      return { labels: [], datasets: [] };
    }
    const labels = ["Annual", "Pre-Mon", "Post-Mon"]; // Shortened labels
    const data = [
      parseFloat(groundwaterData.stressAnalysis.annualDeclineRate) || 0,
      parseFloat(groundwaterData.stressAnalysis.preMonsoonDeclineRate) || 0,
      parseFloat(groundwaterData.stressAnalysis.postMonsoonDeclineRate) || 0,
    ];
    return {
      labels,
      datasets: [{ data }],
    };
  };

  // Minimal chart configuration
  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue-500
    labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`, // Gray-700
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: "3",
      strokeWidth: "1.5",
      stroke: "#3B82F6",
    },
    propsForBackgroundLines: {
      strokeDasharray: "", // solid lines
      stroke: "#E5E7EB", // Gray-200
      strokeWidth: 1,
    },
    decimalPlaces: 1,
    style: {
      borderRadius: 8,
    },
  };

  // Calculate chart width based on screen width with proper padding
  const chartWidth = screenWidth - 48; // Account for card padding and margins
  const chartHeight = 200; // Fixed height for consistency

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Groundwater Dashboard</Text>

      {/* Search Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Searchbar
            placeholder="Search places in Rajasthan (e.g., Jaipur, Udaipur, Jodhpur)"
            onChangeText={setSearchQuery}
            value={searchQuery}
            onIconPress={handleSearch}
            onSubmitEditing={handleSearch}
            style={styles.searchBar}
            loading={loading}
          />

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggestions:</Text>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSuggestionSelect(suggestion)}
                >
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    📍 {suggestion.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Popular Places */}
          <View style={styles.popularContainer}>
            <Text style={styles.popularTitle}>Popular Places:</Text>
            <View style={styles.chipsContainer}>
              {POPULAR_PLACES.map((place, index) => (
                <Chip
                  key={index}
                  mode="outlined"
                  onPress={() => handlePopularPlaceSelect(place.name)}
                  style={styles.chip}
                  textStyle={styles.chipText}
                >
                  {place.name}
                </Chip>
              ))}
            </View>
          </View>

          <TouchableOpacity
            onPress={getCurrentLocation}
            style={styles.locationButton}
            disabled={loading}
          >
            <Text style={styles.locationButtonText}>📍 Use Current Location</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Fetching groundwater data...</Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <Card style={[styles.card, styles.errorCard]}>
          <Card.Content>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </Card.Content>
        </Card>
      )}

      {/* Main Data Display */}
      {groundwaterData && (
        <>
          {/* Location & Current Status */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>📍 Location Analysis</Text>
              <Text style={styles.locationText}>{locationName}</Text>

              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                  <Text style={styles.statusText}>
                    {groundwaterData.stressAnalysis?.category || "Unknown"}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {groundwaterData.currentWaterLevel || "N/A"}m
                  </Text>
                  <Text style={styles.statLabel}>Current Level</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {groundwaterData.nearestStation?.distanceKm || "N/A"}km
                  </Text>
                  <Text style={styles.statLabel}>Distance to Station</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Station Information */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>🔬 Monitoring Station</Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>Station: </Text>
                {groundwaterData.nearestStation?.stationName || "Unknown"}
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>Well Type: </Text>
                {groundwaterData.nearestStation?.wellType || "Unknown"}
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>Well Depth: </Text>
                {groundwaterData.nearestStation?.wellDepth
                  ? `${groundwaterData.nearestStation.wellDepth}m`
                  : "Unknown"}
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoLabel}>Aquifer Type: </Text>
                {groundwaterData.nearestStation?.wellAquiferType || "Unknown"}
              </Text>
              {groundwaterData.nearestStation?.note && (
                <Text style={styles.noteText}>
                  ℹ️ {groundwaterData.nearestStation.note}
                </Text>
              )}
            </Card.Content>
          </Card>

          {/* Recharge Values (Line Chart) */}
          {groundwaterData.rechargePattern && groundwaterData.rechargePattern.length > 0 && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>💧 Recharge Trend</Text>
                <View style={styles.chartContainer}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#3B82F6" />
                  ) : (
                    <LineChart
                      data={getRechargeLineData()}
                      width={chartWidth}
                      height={chartHeight}
                      yAxisSuffix="m"
                      chartConfig={chartConfig}
                      bezier
                      style={styles.chart}
                      withInnerLines={true}
                      withOuterLines={false}
                      withHorizontalLines={true}
                      withVerticalLines={false}
                      withDots={true}
                      withShadow={false}
                    />
                  )}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Historical Data (Bar Chart) - Display ALL years */}
          {groundwaterData.historicalLevels && groundwaterData.historicalLevels.length > 0 && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>📊 Historical Water Levels</Text>
                <View style={styles.chartContainer}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#3B82F6" />
                  ) : (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.horizontalScrollChart}
                    >
                      <BarChart
                        data={getHistoricalBarData()}
                        width={Math.max(chartWidth, groundwaterData.historicalLevels.length * 40)} // Dynamic width based on data
                        height={chartHeight}
                        yAxisSuffix="m"
                        chartConfig={chartConfig}
                        style={styles.chart}
                        withInnerLines={true}
                        withOuterLines={false}
                        withHorizontalLines={true}
                        withVerticalLines={false}
                        showValuesOnTopOfBars={false}
                        fromZero={false}
                      />
                    </ScrollView>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Trend Analysis (Bar Chart) */}
          {groundwaterData.stressAnalysis && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>📈 Decline Rate Analysis</Text>
                <View style={styles.chartContainer}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#3B82F6" />
                  ) : (
                    <BarChart
                      data={getTrendBarData()}
                      width={chartWidth}
                      height={chartHeight}
                      yAxisSuffix="m"
                      chartConfig={chartConfig}
                      style={styles.chart}
                      withInnerLines={true}
                      withOuterLines={false}
                      withHorizontalLines={true}
                      withVerticalLines={false}
                      showValuesOnTopOfBars={false}
                      fromZero={true}
                    />
                  )}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Decision Support */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>📋 Decision Support Insights</Text>
              <Text style={styles.infoText}>
                📊 Current groundwater recharge is{" "}
                {groundwaterData.rechargeTrend?.description || "unknown"}. Risk of stress in next 7
                days.
                {"\n"}✅ Recommendation: {groundwaterData.stressAnalysis?.trend === "declining"
                  ? "Reduce irrigation pumping."
                  : "Maintain current usage."}
                {"\n"}⚡ Forecast: {groundwaterData.rechargeTrend?.annualChange > 0
                  ? "Increasing recharge expected."
                  : "Stable recharge expected."}
              </Text>
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1f2937",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
  },
  searchBar: {
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  suggestionsContainer: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  suggestionItem: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  suggestionText: {
    fontSize: 14,
    color: "#374151",
  },
  popularContainer: {
    marginBottom: 16,
  },
  popularTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    marginBottom: 4,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
  },
  locationButton: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  locationButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  serviceInfo: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 16,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 16,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1f2937",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    color: "#1f2937",
  },
  locationText: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 12,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: "600",
    color: "#1f2937",
  },
  noteText: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 8,
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 6,
  },
  chartContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  chart: {
    borderRadius: 8,
  },
  horizontalScrollChart: {
    marginTop: 8,
  },
});