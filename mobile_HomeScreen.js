// mobile/src/screens/client/HomeScreen.js
// Client Home Screen - Main map view with request driver functionality

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector, useDispatch } from 'react-redux';
import { requestTrip } from '../../redux/slices/tripSlice';

const NAIROBI_REGION = {
  latitude: -1.286389,
  longitude: 36.817223,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const mapRef = useRef(null);
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [isSelectingPickup, setIsSelectingPickup] = useState(true);
  const [loading, setLoading] = useState(false);

  const { user } = useSelector(state => state.auth);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { latitude, longitude };
        setCurrentLocation(location);
        setPickupLocation(location); // Default pickup to current location
        reverseGeocode(location, true);
      },
      (error) => {
        console.error('Location error:', error);
        Alert.alert('Error', 'Could not get your location');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  const reverseGeocode = async (location, isPickup) => {
    try {
      // Use Google Maps Geocoding API or any geocoding service
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=YOUR_API_KEY`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        if (isPickup) {
          setPickupAddress(address);
        } else {
          setDropoffAddress(address);
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const handleMapPress = (e) => {
    const location = e.nativeEvent.coordinate;
    
    if (isSelectingPickup) {
      setPickupLocation(location);
      reverseGeocode(location, true);
    } else {
      setDropoffLocation(location);
      reverseGeocode(location, false);
    }
  };

  const handleRequestDriver = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Missing Information', 'Please select both pickup and dropoff locations');
      return;
    }

    setLoading(true);

    try {
      const tripData = {
        pickup_location: {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          address: pickupAddress
        },
        dropoff_location: {
          latitude: dropoffLocation.latitude,
          longitude: dropoffLocation.longitude,
          address: dropoffAddress
        }
      };

      const result = await dispatch(requestTrip(tripData)).unwrap();
      
      navigation.navigate('TripRequest', {
        tripId: result.trip_id,
        estimatedPrice: result.estimated_price,
        estimatedDistance: result.estimated_distance_km,
        estimatedDuration: result.estimated_duration_min
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to request driver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={NAIROBI_REGION}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Pickup Location"
            pinColor="green"
          />
        )}

        {/* Dropoff Marker */}
        {dropoffLocation && (
          <Marker
            coordinate={dropoffLocation}
            title="Dropoff Location"
            pinColor="red"
          />
        )}
      </MapView>

      {/* Top Card - Location Selection */}
      <View style={styles.topCard}>
        <Text style={styles.greeting}>Hello, {user?.full_name || 'User'}!</Text>
        
        {/* Pickup Location */}
        <View style={styles.locationRow}>
          <Icon name="my-location" size={24} color="#4CAF50" />
          <TextInput
            style={styles.locationInput}
            placeholder="Pickup location"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            onFocus={() => setIsSelectingPickup(true)}
          />
        </View>

        {/* Dropoff Location */}
        <View style={styles.locationRow}>
          <Icon name="location-on" size={24} color="#F44336" />
          <TextInput
            style={styles.locationInput}
            placeholder="Where to?"
            value={dropoffAddress}
            onChangeText={setDropoffAddress}
            onFocus={() => setIsSelectingPickup(false)}
          />
        </View>

        <Text style={styles.hint}>
          {isSelectingPickup 
            ? 'Tap on the map to set pickup location'
            : 'Tap on the map to set dropoff location'}
        </Text>
      </View>

      {/* Bottom Card - Request Button */}
      {pickupLocation && dropoffLocation && (
        <View style={styles.bottomCard}>
          <TouchableOpacity
            style={[styles.requestButton, loading && styles.disabledButton]}
            onPress={handleRequestDriver}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.requestButtonText}>Request Driver</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* My Location Button */}
      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={getCurrentLocation}
      >
        <Icon name="my-location" size={24} color="#333" />
      </TouchableOpacity>

      {/* Menu Button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => navigation.openDrawer()}
      >
        <Icon name="menu" size={28} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topCard: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  greeting: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  locationInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#A5D6A7',
  },
  requestButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    backgroundColor: '#FFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: '#FFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default HomeScreen;
