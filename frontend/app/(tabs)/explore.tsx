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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from 'react-native-paper';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ExploreScreen() {
  const [region, setRegion] = useState({
    latitude: 26.9124,
    longitude: 75.7873,
    latitudeDelta: 5,
    longitudeDelta: 5,
  });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState([]);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [selectedStation, setSelectedStation] = useState(null);

  const API_BASE_URL = "https://makhi-enuretic-sherrie.ngrok-free.dev";

  // Sample stations for Rajasthan (you can fetch these from your backend)
  const SAMPLE_STATIONS = [
    { id: 1, name: 'Jaipur Station', lat: 26.9124, lon: 75.7873, level: 45.2, status: 'safe' },
    { id: 2, name: 'Jodhpur Station', lat: 26.2389, lon: 73.0243, level: 32.5, status: 'critical' },
    { id: 3, name: 'Udaipur Station', lat: 24.5854, lon: 73.7125, level: 52.8, status: 'safe' },
    { id: 4, name: 'Bikaner Station', lat: 28.0229, lon: 73.3119, level: 28.3, status: 'over-exploited' },
    { id: 5, name: 'Ajmer Station', lat: 26.4499, lon: 74.6399, level: 38.7, status: 'semi-critical' },
  ];

  useEffect(() => {
    getCurrentLocation();
    setStations(SAMPLE_STATIONS);
  }, []);

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

  const renderStation = ({ item }) => (
    <TouchableOpacity onPress={() => handleStationCardPress(item)}>
      <Card style={styles.stationCard}>
        <Card.Content>
          <View style={styles.stationHeader}>
            <View style={styles.stationInfo}>
              <Text style={styles.stationName}>{item.name}</Text>
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
          <Text style={styles.headerTitle}>🗺️ Explore Stations</Text>
          <Text style={styles.headerSubtitle}>Groundwater monitoring locations</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')} 
          style={styles.viewToggleButton}
        >
          <Ionicons 
            name={viewMode === 'map' ? 'list' : 'map'} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.locationButton}>
          <Ionicons name="locate" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading stations...</Text>
        </View>
      ) : viewMode === 'map' ? (
        <>
          <MapView
            provider={PROVIDER_GOOGLE}
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
        <FlatList
          data={stations}
          renderItem={renderStation}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.legend}>
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
      </View>
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
