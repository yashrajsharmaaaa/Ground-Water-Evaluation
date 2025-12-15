// @ts-nocheck
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  StatusBar,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { Card, Chip, Searchbar } from "react-native-paper";
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationName, setLocationName] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [groundwaterData, setGroundwaterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Backend API URL - Local development (use your PC's IP address)
  const API_BASE_URL = "http://192.168.0.193:3000";

  // Popular places across 12 water-stressed states
  const POPULAR_PLACES = [
    // Rajasthan
    { name: "Jaipur", state: "Rajasthan", lat: 26.91, lon: 75.79 },
    { name: "Jodhpur", state: "Rajasthan", lat: 26.24, lon: 73.02 },
    { name: "Udaipur", state: "Rajasthan", lat: 24.58, lon: 73.71 },
    // Gujarat
    { name: "Ahmedabad", state: "Gujarat", lat: 23.03, lon: 72.58 },
    { name: "Surat", state: "Gujarat", lat: 21.17, lon: 72.83 },
    // Maharashtra
    { name: "Mumbai", state: "Maharashtra", lat: 19.07, lon: 72.87 },
    { name: "Pune", state: "Maharashtra", lat: 18.52, lon: 73.85 },
    // Uttar Pradesh
    { name: "Lucknow", state: "Uttar Pradesh", lat: 26.85, lon: 80.95 },
    { name: "Kanpur", state: "Uttar Pradesh", lat: 26.45, lon: 80.35 },
    // Madhya Pradesh
    { name: "Bhopal", state: "Madhya Pradesh", lat: 23.26, lon: 77.41 },
    { name: "Indore", state: "Madhya Pradesh", lat: 22.72, lon: 75.86 },
    // Tamil Nadu
    { name: "Chennai", state: "Tamil Nadu", lat: 13.08, lon: 80.27 },
    { name: "Coimbatore", state: "Tamil Nadu", lat: 11.02, lon: 76.97 },
    // Telangana
    { name: "Hyderabad", state: "Telangana", lat: 17.39, lon: 78.49 },
    // Andhra Pradesh
    { name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.69, lon: 83.21 },
    // Punjab
    { name: "Ludhiana", state: "Punjab", lat: 30.90, lon: 75.85 },
    { name: "Amritsar", state: "Punjab", lat: 31.63, lon: 74.87 },
    // Haryana
    { name: "Gurugram", state: "Haryana", lat: 28.46, lon: 77.03 },
    { name: "Faridabad", state: "Haryana", lat: 28.41, lon: 77.31 },
    // Delhi
    { name: "New Delhi", state: "Delhi", lat: 28.61, lon: 77.21 },
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
      setLoadingProgress(0);
      setLoadingMessage("Connecting to server...");

      // Simulate progress updates for better UX
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 1000);

      // Update loading messages
      setTimeout(() => setLoadingMessage("Fetching district data..."), 1000);
      setTimeout(() => setLoadingMessage("Querying WRIS database..."), 3000);
      setTimeout(() => setLoadingMessage("Processing historical data..."), 6000);
      setTimeout(() => setLoadingMessage("Calculating predictions..."), 9000);

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

      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingMessage("Complete!");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setGroundwaterData(data);
      setLocationName(placeName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch (err) {
      setError(err.message);
      setLoadingProgress(0);
      setLoadingMessage("");
      Alert.alert(
        "Error",
        `Failed to fetch groundwater data: ${err.message}. Please check your network or try again.`
      );
    } finally {
      setLoading(false);
      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingMessage("");
      }, 500);
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
      Alert.alert("Input Required", "Please enter a city name (e.g., Jaipur, Mumbai, Chennai)");
      return;
    }

    try {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const results = POPULAR_PLACES.filter((place) =>
        place.name.toLowerCase().includes(normalizedQuery) ||
        place.state.toLowerCase().includes(normalizedQuery)
      ).map((place) => ({
        name: `${place.name}, ${place.state}, India`,
        lat: place.lat,
        lon: place.lon,
      }));

      if (results.length === 0) {
        throw new Error(`No locations found for "${searchQuery}". Try: Jaipur, Mumbai, Chennai, Hyderabad`);
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
        `${location.name}, ${location.state}, India`
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
        place.name.toLowerCase().includes(normalizedQuery) ||
        place.state.toLowerCase().includes(normalizedQuery)
      ).map((place) => ({
        name: `${place.name}, ${place.state}, India`,
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

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    if (currentLocation) {
      await fetchGroundwaterData(
        currentLocation.lat,
        currentLocation.lon,
        locationName
      );
    }
    setRefreshing(false);
  };

  // Loading Skeleton Component
  const LoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
        </View>
      ))}
    </View>
  );

  // Calculate chart width based on screen width with proper padding
  const chartWidth = screenWidth - 48; // Account for card padding and margins
  const chartHeight = 200; // Fixed height for consistency

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
      >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.title}>💧 JalMitra Dashboard</Text>
          <Text style={styles.subtitle}>All India Coverage • 414 Districts • 12 States</Text>
        </View>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Search Section */}
      <Card style={styles.card} elevation={2}>
        <Card.Content>
          <Searchbar
            placeholder="Search cities across India (e.g., Jaipur, Mumbai, Chennai)"
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
            <Text style={styles.popularTitle}>🌍 Popular Cities Across India:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScrollView}
            >
              <View style={styles.chipsContainer}>
                {POPULAR_PLACES.slice(0, 10).map((place, index) => (
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
            </ScrollView>
            <Text style={styles.coverageText}>
              ✅ Covering 12 water-stressed states: Rajasthan, Gujarat, Maharashtra, UP, MP, Karnataka, Tamil Nadu, Telangana, AP, Punjab, Haryana, Delhi
            </Text>
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

      {/* Loading Indicator with Progress */}
      {loading && !refreshing && (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.loadingProgressContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingProgressText}>{loadingMessage}</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${loadingProgress}%` }]} />
              </View>
              <Text style={styles.progressPercentage}>{loadingProgress}%</Text>
              <Text style={styles.loadingHint}>
                {loadingProgress < 30 && "⏳ This may take 30-60 seconds..."}
                {loadingProgress >= 30 && loadingProgress < 60 && "🔄 Fetching data from government servers..."}
                {loadingProgress >= 60 && loadingProgress < 90 && "📊 Processing water level data..."}
                {loadingProgress >= 90 && "✅ Almost done!"}
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Error Display */}
      {error && !loading && (
        <Card style={[styles.card, styles.errorCard]} elevation={1}>
          <Card.Content>
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#DC2626" />
              <Text style={styles.errorTitle}>Connection Error</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                  if (currentLocation) {
                    fetchGroundwaterData(currentLocation.lat, currentLocation.lon, locationName);
                  }
                }}
              >
                <Ionicons name="refresh" size={20} color="#FFF" />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
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

          {/* Future Predictions */}
          {groundwaterData.predictions?.futureWaterLevels && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>🔮 Future Water Level Predictions</Text>
                <Text style={styles.predictionMethodology}>
                  {groundwaterData.predictions.futureWaterLevels.methodology}
                </Text>
                <View style={styles.confidenceBadgeContainer}>
                  <View style={[
                    styles.confidenceBadge,
                    { backgroundColor: 
                      groundwaterData.predictions.futureWaterLevels.confidence === 'high' ? '#16A34A' :
                      groundwaterData.predictions.futureWaterLevels.confidence === 'medium' ? '#D97706' : '#DC2626'
                    }
                  ]}>
                    <Text style={styles.confidenceText}>
                      {groundwaterData.predictions.futureWaterLevels.confidence.toUpperCase()} CONFIDENCE
                    </Text>
                  </View>
                </View>
                {groundwaterData.predictions.futureWaterLevels.predictions.map((pred, index) => (
                  <View key={index} style={styles.predictionRow}>
                    <View style={styles.predictionYear}>
                      <Text style={styles.predictionYearText}>{pred.year}yr</Text>
                    </View>
                    <View style={styles.predictionDetails}>
                      <Text style={styles.predictionLevel}>{pred.predictedLevel}m</Text>
                      <Text style={styles.predictionDate}>{pred.date}</Text>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Stress Category Transition */}
          {groundwaterData.predictions?.stressCategoryTransition && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>⚠️ Stress Category Forecast</Text>
                <View style={styles.stressCurrentContainer}>
                  <Text style={styles.stressLabel}>Current Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                    <Text style={styles.statusText}>
                      {groundwaterData.predictions.stressCategoryTransition.currentCategory}
                    </Text>
                  </View>
                </View>
                <Text style={styles.stressDeclineRate}>
                  Decline Rate: {groundwaterData.predictions.stressCategoryTransition.currentDeclineRate}m/year
                </Text>
                
                {groundwaterData.predictions.stressCategoryTransition.predictions?.nextCategory ? (
                  <>
                    <View style={styles.transitionContainer}>
                      <Ionicons name="arrow-forward" size={24} color="#DC2626" />
                      <View style={styles.transitionInfo}>
                        <Text style={styles.transitionLabel}>Transitioning to:</Text>
                        <Text style={styles.transitionCategory}>
                          {groundwaterData.predictions.stressCategoryTransition.predictions.nextCategory}
                        </Text>
                        <Text style={styles.transitionTime}>
                          In {groundwaterData.predictions.stressCategoryTransition.predictions.yearsUntilTransition} years
                        </Text>
                        <Text style={styles.transitionDate}>
                          Expected: {groundwaterData.predictions.stressCategoryTransition.predictions.estimatedTransitionDate}
                        </Text>
                      </View>
                    </View>
                    {groundwaterData.predictions.stressCategoryTransition.predictions.warning && (
                      <View style={styles.warningBox}>
                        <Ionicons name="warning" size={20} color="#DC2626" />
                        <Text style={styles.warningText}>
                          {groundwaterData.predictions.stressCategoryTransition.predictions.warning}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.stableBox}>
                    <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                    <Text style={styles.stableText}>
                      {groundwaterData.predictions.stressCategoryTransition.predictions?.message || 'Stable conditions'}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Seasonal Predictions */}
          {groundwaterData.predictions?.seasonalPredictions && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>🌦️ Seasonal Forecast</Text>
                <Text style={styles.seasonalMethodology}>
                  {groundwaterData.predictions.seasonalPredictions.methodology}
                </Text>
                <Text style={styles.currentSeason}>
                  Current Season: {groundwaterData.predictions.seasonalPredictions.currentSeason}
                </Text>
                
                {/* Next Season */}
                <View style={styles.seasonCard}>
                  <View style={styles.seasonHeader}>
                    <Text style={styles.seasonTitle}>
                      {groundwaterData.predictions.seasonalPredictions.nextSeason.season}
                    </Text>
                    <Text style={styles.seasonPeriod}>
                      {groundwaterData.predictions.seasonalPredictions.nextSeason.period}
                    </Text>
                  </View>
                  <View style={styles.seasonStats}>
                    <View style={styles.seasonStat}>
                      <Text style={styles.seasonStatLabel}>Predicted Level</Text>
                      <Text style={styles.seasonStatValue}>
                        {groundwaterData.predictions.seasonalPredictions.nextSeason.predictedLevel}m
                      </Text>
                    </View>
                    <View style={styles.seasonStat}>
                      <Text style={styles.seasonStatLabel}>Expected Recharge</Text>
                      <Text style={[
                        styles.seasonStatValue,
                        { color: groundwaterData.predictions.seasonalPredictions.nextSeason.expectedRecharge > 0 ? '#16A34A' : '#DC2626' }
                      ]}>
                        {groundwaterData.predictions.seasonalPredictions.nextSeason.expectedRecharge > 0 ? '+' : ''}
                        {groundwaterData.predictions.seasonalPredictions.nextSeason.expectedRecharge}m
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Following Season */}
                <View style={styles.seasonCard}>
                  <View style={styles.seasonHeader}>
                    <Text style={styles.seasonTitle}>
                      {groundwaterData.predictions.seasonalPredictions.followingSeason.season}
                    </Text>
                    <Text style={styles.seasonPeriod}>
                      {groundwaterData.predictions.seasonalPredictions.followingSeason.period}
                    </Text>
                  </View>
                  <View style={styles.seasonStats}>
                    <View style={styles.seasonStat}>
                      <Text style={styles.seasonStatLabel}>Predicted Level</Text>
                      <Text style={styles.seasonStatValue}>
                        {groundwaterData.predictions.seasonalPredictions.followingSeason.predictedLevel}m
                      </Text>
                    </View>
                    <View style={styles.seasonStat}>
                      <Text style={styles.seasonStatLabel}>Expected Recharge</Text>
                      <Text style={[
                        styles.seasonStatValue,
                        { color: groundwaterData.predictions.seasonalPredictions.followingSeason.expectedRecharge > 0 ? '#16A34A' : '#DC2626' }
                      ]}>
                        {groundwaterData.predictions.seasonalPredictions.followingSeason.expectedRecharge > 0 ? '+' : ''}
                        {groundwaterData.predictions.seasonalPredictions.followingSeason.expectedRecharge}m
                      </Text>
                    </View>
                  </View>
                </View>

                {groundwaterData.predictions.seasonalPredictions.confidence && (
                  <View style={styles.confidenceBadgeContainer}>
                    <View style={[
                      styles.confidenceBadge,
                      { backgroundColor: 
                        groundwaterData.predictions.seasonalPredictions.confidence === 'high' ? '#16A34A' :
                        groundwaterData.predictions.seasonalPredictions.confidence === 'medium' ? '#D97706' : '#DC2626'
                      }
                    ]}>
                      <Text style={styles.confidenceText}>
                        {groundwaterData.predictions.seasonalPredictions.confidence.toUpperCase()} CONFIDENCE
                      </Text>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Prediction Errors */}
          {groundwaterData.predictions?.errors && groundwaterData.predictions.errors.length > 0 && (
            <Card style={[styles.card, styles.errorCard]}>
              <Card.Content>
                <Text style={styles.cardTitle}>⚠️ Prediction Limitations</Text>
                {groundwaterData.predictions.errors.map((error, index) => (
                  <View key={index} style={styles.errorItem}>
                    <Ionicons name="information-circle" size={20} color="#D97706" />
                    <View style={styles.errorContent}>
                      <Text style={styles.errorMessage}>{error.message}</Text>
                      <Text style={styles.errorAffected}>
                        Affected: {error.affectedPredictions.join(', ')}
                      </Text>
                    </View>
                  </View>
                ))}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  contentContainer: {
    padding: 16,
    paddingTop: 12,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  infoButton: {
    padding: 8,
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
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 12,
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  skeletonTitle: {
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 12,
    width: '60%',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginBottom: 8,
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
  chipsScrollView: {
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    marginBottom: 4,
  },
  chipText: {
    fontSize: 12,
  },
  coverageText: {
    fontSize: 11,
    color: "#16A34A",
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 16,
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
  // Prediction styles
  predictionMethodology: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  confidenceBadgeContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  predictionYear: {
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  predictionYearText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  predictionDetails: {
    flex: 1,
  },
  predictionLevel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  predictionDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // Stress transition styles
  stressCurrentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  stressDeclineRate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  transitionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  transitionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transitionLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  transitionCategory: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 2,
  },
  transitionTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  transitionDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  warningText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  stableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  stableText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  // Seasonal prediction styles
  seasonalMethodology: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  currentSeason: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  seasonCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  seasonHeader: {
    marginBottom: 12,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  seasonPeriod: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  seasonStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seasonStat: {
    flex: 1,
  },
  seasonStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  seasonStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  // Error styles
  errorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  errorContent: {
    marginLeft: 8,
    flex: 1,
  },
  errorMessage: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  errorAffected: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // Loading progress styles
  loadingProgressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingProgressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  loadingHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});