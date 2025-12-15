// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from 'react-native-paper';
import MapView, { Marker, Callout } from 'react-native-maps';
import apiClient from '@/services/apiClient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ExploreScreen() {
  // Center on India (All India view)
  const [region, setRegion] = useState({
    latitude: 22.5, // Center of India
    longitude: 78.5,
    latitudeDelta: 20, // Zoom out to show all of India
    longitudeDelta: 20,
  });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState([]);
  const [viewMode, setViewMode] = useState('insights'); // 'insights', 'map', or 'list'
  const [selectedStation, setSelectedStation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [insights, setInsights] = useState(null);

  // 12 water-stressed states covered by JalMitra
  const COVERED_STATES = [
    'All', 'Rajasthan', 'Gujarat', 'Maharashtra', 'Uttar Pradesh', 
    'Madhya Pradesh', 'Karnataka', 'Tamil Nadu', 'Telangana', 
    'Andhra Pradesh', 'Punjab', 'Haryana', 'Delhi'
  ];

  // Sample stations across 12 water-stressed states (fallback if API fails)
  const SAMPLE_STATIONS = [
    { id: 1, name: 'Jaipur Station', state: 'Rajasthan', lat: 26.9124, lon: 75.7873, level: 34.1, status: 'safe', trend: 'declining' },
    { id: 2, name: 'Jodhpur Station', state: 'Rajasthan', lat: 26.2389, lon: 73.0243, level: 32.5, status: 'critical', trend: 'declining' },
    { id: 3, name: 'Ahmedabad Station', state: 'Gujarat', lat: 23.03, lon: 72.58, level: 70.5, status: 'over-exploited', trend: 'declining' },
    { id: 4, name: 'Surat Station', state: 'Gujarat', lat: 21.17, lon: 72.83, level: 45.2, status: 'semi-critical', trend: 'stable' },
    { id: 5, name: 'Mumbai Station', state: 'Maharashtra', lat: 19.07, lon: 72.87, level: 2.95, status: 'safe', trend: 'rising' },
    { id: 6, name: 'Pune Station', state: 'Maharashtra', lat: 18.52, lon: 73.85, level: 4.60, status: 'safe', trend: 'stable' },
    { id: 7, name: 'Lucknow Station', state: 'Uttar Pradesh', lat: 26.85, lon: 80.95, level: 39.3, status: 'semi-critical', trend: 'declining' },
    { id: 8, name: 'Bhopal Station', state: 'Madhya Pradesh', lat: 23.26, lon: 77.41, level: 1.80, status: 'safe', trend: 'stable' },
    { id: 9, name: 'Chennai Station', state: 'Tamil Nadu', lat: 13.08, lon: 80.27, level: 1.87, status: 'critical', trend: 'declining' },
    { id: 10, name: 'Hyderabad Station', state: 'Telangana', lat: 17.39, lon: 78.49, level: 11.0, status: 'semi-critical', trend: 'declining' },
    { id: 11, name: 'Visakhapatnam Station', state: 'Andhra Pradesh', lat: 17.69, lon: 83.21, level: 10.7, status: 'safe', trend: 'stable' },
    { id: 12, name: 'Ludhiana Station', state: 'Punjab', lat: 30.90, lon: 75.85, level: 33.6, status: 'over-exploited', trend: 'declining' },
    { id: 13, name: 'Gurugram Station', state: 'Haryana', lat: 28.46, lon: 77.03, level: 21.3, status: 'critical', trend: 'declining' },
  ];

  useEffect(() => {
    getCurrentLocation();
    loadStationsData();
  }, []);

  // Compute insights from station data
  useEffect(() => {
    if (stations.length > 0) {
      computeInsights();
    }
  }, [stations]);

  const loadStationsData = () => {
    // For now, use sample data. In production, this would fetch from backend
    // Backend would need a new endpoint: GET /api/stations/all
    setStations(SAMPLE_STATIONS);
  };

  const computeInsights = () => {
    const total = stations.length;
    const byStatus = {
      safe: stations.filter(s => s.status === 'safe').length,
      'semi-critical': stations.filter(s => s.status === 'semi-critical').length,
      critical: stations.filter(s => s.status === 'critical').length,
      'over-exploited': stations.filter(s => s.status === 'over-exploited').length,
    };
    
    const declining = stations.filter(s => s.trend === 'declining').length;
    const avgLevel = (stations.reduce((sum, s) => sum + s.level, 0) / total).toFixed(2);
    
    // Find most critical districts
    const criticalStations = stations
      .filter(s => s.status === 'critical' || s.status === 'over-exploited')
      .sort((a, b) => {
        const statusOrder = { 'over-exploited': 0, 'critical': 1 };
        return statusOrder[a.status] - statusOrder[b.status];
      })
      .slice(0, 5);

    setInsights({
      total,
      byStatus,
      declining,
      avgLevel,
      criticalStations,
      statesCount: new Set(stations.map(s => s.state)).size,
    });
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your position on the map.');
        return;
      }

      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(userLocation);
      setRegion({
        ...userLocation,
        latitudeDelta: 2,
        longitudeDelta: 2,
      });
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (status) => {
    switch (status) {
      case 'safe':
        return '#16A34A';
      case 'semi-critical':
        return '#D97706';
      case 'critical':
        return '#EA580C';
      case 'over-exploited':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  const handleMarkerPress = (station) => {
    setSelectedStation(station);
    // Center map on selected station
    setRegion({
      latitude: station.lat,
      longitude: station.lon,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    });
  };

  const handleStationCardPress = (station) => {
    setViewMode('map');
    handleMarkerPress(station);
  };

  // Filter stations based on search, state, and status
  const filteredStations = stations.filter(station => {
    const matchesSearch = station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         station.state.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = selectedState === 'All' || station.state === selectedState;
    const matchesStatus = selectedStatus === 'All' || station.status === selectedStatus;
    return matchesSearch && matchesState && matchesStatus;
  });

  const renderInsightsView = () => {
    if (!insights) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Computing insights...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.insightsContainer} showsVerticalScrollIndicator={false}>
        {/* Overview Cards */}
        <View style={styles.overviewGrid}>
          <Card style={styles.overviewCard}>
            <Card.Content>
              <Ionicons name="water" size={32} color="#007AFF" />
              <Text style={styles.overviewNumber}>{insights.total}</Text>
              <Text style={styles.overviewLabel}>Monitoring Stations</Text>
            </Card.Content>
          </Card>
          
          <Card style={styles.overviewCard}>
            <Card.Content>
              <Ionicons name="location" size={32} color="#16A34A" />
              <Text style={styles.overviewNumber}>{insights.statesCount}</Text>
              <Text style={styles.overviewLabel}>States Covered</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Status Distribution */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>📊 Status Distribution</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.statusCount}>{insights.byStatus.safe}</Text>
                <Text style={styles.statusLabel}>Safe</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.statusCount}>{insights.byStatus['semi-critical']}</Text>
                <Text style={styles.statusLabel}>Semi-Critical</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#EA580C' }]} />
                <Text style={styles.statusCount}>{insights.byStatus.critical}</Text>
                <Text style={styles.statusLabel}>Critical</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.statusCount}>{insights.byStatus['over-exploited']}</Text>
                <Text style={styles.statusLabel}>Over-Exploited</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Key Metrics */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>📈 Key Metrics</Text>
            <View style={styles.metricRow}>
              <Ionicons name="trending-down" size={20} color="#DC2626" />
              <Text style={styles.metricText}>
                <Text style={styles.metricValue}>{insights.declining}</Text> stations showing declining trend
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Ionicons name="analytics" size={20} color="#007AFF" />
              <Text style={styles.metricText}>
                Average water level: <Text style={styles.metricValue}>{insights.avgLevel}m</Text>
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Critical Districts Alert */}
        {insights.criticalStations.length > 0 && (
          <Card style={[styles.sectionCard, styles.alertCard]}>
            <Card.Content>
              <View style={styles.alertHeader}>
                <Ionicons name="warning" size={24} color="#DC2626" />
                <Text style={styles.alertTitle}>Critical Districts Requiring Attention</Text>
              </View>
              {insights.criticalStations.map((station, index) => (
                <TouchableOpacity 
                  key={station.id} 
                  style={styles.criticalItem}
                  onPress={() => handleStationCardPress(station)}
                >
                  <View style={styles.criticalInfo}>
                    <Text style={styles.criticalName}>{station.name}</Text>
                    <Text style={styles.criticalState}>{station.state}</Text>
                  </View>
                  <View style={[styles.statusBadgeSmall, { backgroundColor: getMarkerColor(station.status) }]}>
                    <Text style={styles.statusTextSmall}>{station.status.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Actionable Recommendations */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>💡 Recommendations</Text>
            <View style={styles.recommendationItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text style={styles.recommendationText}>
                Monitor {insights.byStatus.critical + insights.byStatus['over-exploited']} high-risk districts closely
              </Text>
            </View>
            <View style={styles.recommendationItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text style={styles.recommendationText}>
                Implement water conservation in {insights.declining} declining areas
              </Text>
            </View>
            <View style={styles.recommendationItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text style={styles.recommendationText}>
                Use chatbot for detailed analysis of specific districts
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  const renderStation = ({ item }) => (
    <TouchableOpacity onPress={() => handleStationCardPress(item)}>
      <Card style={styles.stationCard}>
        <Card.Content>
          <View style={styles.stationHeader}>
            <View style={styles.stationInfo}>
              <Text style={styles.stationName}>{item.name}</Text>
              <Text style={styles.stationState}>🏛️ {item.state}</Text>
              <Text style={styles.stationCoords}>
                📍 {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getMarkerColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.levelContainer}>
            <Ionicons name="water" size={24} color="#007AFF" />
            <Text style={styles.levelText}>{item.level}m</Text>
            <Text style={styles.levelLabel}>Water Level</Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🗺️ All India Coverage</Text>
          <Text style={styles.headerSubtitle}>414 Districts • 12 Water-Stressed States</Text>
        </View>
        <TouchableOpacity 
          onPress={() => {
            // Cycle through views: insights -> map -> list -> insights
            if (viewMode === 'insights') setViewMode('map');
            else if (viewMode === 'map') setViewMode('list');
            else setViewMode('insights');
          }} 
          style={styles.viewToggleButton}
        >
          <Ionicons 
            name={viewMode === 'insights' ? 'map' : viewMode === 'map' ? 'list' : 'stats-chart'} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
        {viewMode === 'map' && (
          <TouchableOpacity onPress={getCurrentLocation} style={styles.locationButton}>
            <Ionicons name="locate" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search and Filters (only for list view) */}
      {viewMode === 'list' && (
        <View style={styles.filtersContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search stations or states..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
            <TouchableOpacity 
              style={[styles.filterChip, selectedState === 'All' && styles.filterChipActive]}
              onPress={() => setSelectedState('All')}
            >
              <Text style={[styles.filterChipText, selectedState === 'All' && styles.filterChipTextActive]}>
                All States
              </Text>
            </TouchableOpacity>
            {COVERED_STATES.slice(1).map(state => (
              <TouchableOpacity 
                key={state}
                style={[styles.filterChip, selectedState === state && styles.filterChipActive]}
                onPress={() => setSelectedState(state)}
              >
                <Text style={[styles.filterChipText, selectedState === state && styles.filterChipTextActive]}>
                  {state}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
            {['All', 'safe', 'semi-critical', 'critical', 'over-exploited'].map(status => (
              <TouchableOpacity 
                key={status}
                style={[styles.filterChip, selectedStatus === status && styles.filterChipActive]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[styles.filterChipText, selectedStatus === status && styles.filterChipTextActive]}>
                  {status === 'All' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading stations...</Text>
        </View>
      ) : viewMode === 'insights' ? (
        renderInsightsView()
      ) : viewMode === 'map' ? (
        <>
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {stations.map((station) => (
              <Marker
                key={station.id}
                coordinate={{ latitude: station.lat, longitude: station.lon }}
                onPress={() => handleMarkerPress(station)}
              >
                <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(station.status) }]}>
                  <Ionicons name="water" size={20} color="#FFF" />
                </View>
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{station.name}</Text>
                    <Text style={styles.calloutText}>Level: {station.level}m</Text>
                    <Text style={styles.calloutText}>Status: {station.status}</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          
          {selectedStation && (
            <View style={styles.selectedStationCard}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setSelectedStation(null)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.selectedStationName}>{selectedStation.name}</Text>
              <View style={styles.selectedStationInfo}>
                <View style={styles.infoItem}>
                  <Ionicons name="water" size={16} color="#007AFF" />
                  <Text style={styles.infoText}>{selectedStation.level}m</Text>
                </View>
                <View style={[styles.statusBadgeSmall, { backgroundColor: getMarkerColor(selectedStation.status) }]}>
                  <Text style={styles.statusTextSmall}>{selectedStation.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.selectedStationCoords}>
                📍 {selectedStation.lat.toFixed(4)}, {selectedStation.lon.toFixed(4)}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <FlatList
            data={filteredStations}
            renderItem={renderStation}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No stations found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </View>
            }
          />
          <View style={styles.resultsCount}>
            <Text style={styles.resultsText}>
              Showing {filteredStations.length} of {stations.length} stations
            </Text>
          </View>
        </>
      )}

      {viewMode === 'map' && <View style={styles.legend}>
        <Text style={styles.legendTitle}>Status Legend:</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
            <Text style={styles.legendText}>Safe</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
            <Text style={styles.legendText}>Semi-Critical</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
            <Text style={styles.legendText}>Critical</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendText}>Over-Exploited</Text>
          </View>
        </View>
      </View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  // Search and Filters
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  filterChips: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  // Insights View
  insightsContainer: {
    flex: 1,
    padding: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 2,
  },
  overviewNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statusItem: {
    alignItems: 'center',
    width: '22%',
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  metricText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  metricValue: {
    fontWeight: '600',
    color: '#007AFF',
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  criticalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  criticalInfo: {
    flex: 1,
  },
  criticalName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  criticalState: {
    fontSize: 13,
    color: '#6B7280',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  recommendationText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    lineHeight: 22,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  resultsCount: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultsText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  viewToggleButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginRight: 8,
  },
  locationButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    padding: 8,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  selectedStationCard: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  selectedStationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    paddingRight: 32,
  },
  selectedStationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  statusBadgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTextSmall: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFF',
  },
  selectedStationCoords: {
    fontSize: 12,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  stationCard: {
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 2,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  stationState: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '500',
    marginBottom: 4,
  },
  stationCoords: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  levelLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  legend: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
  },
});
