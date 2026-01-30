// mobile/src/screens/client/TripTrackingScreen.js
// Real-time trip tracking with live driver location and SOS button

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector, useDispatch } from 'react-redux';
import io from 'socket.io-client';
import { API_URL } from '../../config';

const TripTrackingScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const mapRef = useRef(null);
  const socketRef = useRef(null);

  const { tripId, driverInfo } = route.params;
  const { token } = useSelector(state => state.auth);

  const [driverLocation, setDriverLocation] = useState(null);
  const [tripStatus, setTripStatus] = useState('accepted');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [sosLoading, setSosLoading] = useState(false);

  useEffect(() => {
    // Connect to Socket.io for real-time updates
    socketRef.current = io(API_URL, {
      auth: { token }
    });

    // Join trip room
    socketRef.current.emit('join_trip', tripId);

    // Listen for driver location updates
    socketRef.current.on('driver_location_update', (data) => {
      const newLocation = {
        latitude: data.latitude,
        longitude: data.longitude,
      };
      setDriverLocation(newLocation);
      
      // Add to route trail
      setRouteCoordinates(prev => [...prev, newLocation]);

      // Center map on driver
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...newLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    });

    // Listen for trip status changes
    socketRef.current.on('trip_status_change', (data) => {
      setTripStatus(data.status);
      
      if (data.status === 'completed') {
        navigation.replace('TripComplete', { tripId });
      } else if (data.status.includes('cancelled')) {
        Alert.alert(
          'Trip Cancelled',
          'Your trip has been cancelled',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [tripId]);

  const handleCallDriver = () => {
    if (driverInfo?.phone) {
      Linking.openURL(`tel:${driverInfo.phone}`);
    }
  };

  const handleSOS = async () => {
    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to trigger an emergency alert? Support will be notified immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              const response = await fetch(`${API_URL}/api/v1/trips/${tripId}/sos`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  current_location: driverLocation
                })
              });

              const data = await response.json();
              
              if (data.success) {
                Alert.alert(
                  'SOS Sent',
                  `Emergency alert sent to support team. Call ${data.support_number} for immediate assistance.`,
                  [
                    {
                      text: 'Call Now',
                      onPress: () => Linking.openURL(`tel:${data.support_number}`)
                    },
                    { text: 'OK' }
                  ]
                );
              } else {
                throw new Error(data.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to send SOS. Please call support directly.');
            } finally {
              setSosLoading(false);
            }
          }
        }
      ]
    );
  };

  const getStatusText = () => {
    switch (tripStatus) {
      case 'accepted':
        return 'Driver is on the way';
      case 'driver_arriving':
        return 'Driver is arriving';
      case 'in_progress':
        return 'Trip in progress';
      default:
        return 'Trip active';
    }
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        followsUserLocation={tripStatus === 'in_progress'}
      >
        {/* Driver Marker */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Driver"
            description={driverInfo?.name}
          >
            <View style={styles.driverMarker}>
              <Icon name="directions-car" size={24} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4CAF50"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Top Info Card */}
      <View style={styles.topCard}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Icon name="person" size={32} color="#FFF" />
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverInfo?.name}</Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#FFC107" />
              <Text style={styles.rating}>{driverInfo?.rating?.toFixed(1)}</Text>
              <Text style={styles.trips}>• {driverInfo?.total_trips} trips</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCallDriver}
          >
            <Icon name="phone" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomCard}>
        {/* SOS Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleSOS}
          disabled={sosLoading}
        >
          {sosLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Icon name="warning" size={32} color="#FFF" />
              <Text style={styles.sosText}>Emergency SOS</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Share Trip Button */}
        <TouchableOpacity style={styles.shareButton}>
          <Icon name="share" size={24} color="#333" />
          <Text style={styles.shareText}>Share Trip</Text>
        </TouchableOpacity>
      </View>
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
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  trips: {
    fontSize: 14,
    color: '#999',
    marginLeft: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  sosButton: {
    backgroundColor: '#F44336',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sosText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  shareButton: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  shareText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
});

export default TripTrackingScreen;
