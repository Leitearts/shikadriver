// backend/src/utils/location.js
// Location and driver matching utilities

const db = require('../db');

/**
 * Find nearby available drivers within a radius
 * @param {number} latitude - Client's latitude
 * @param {number} longitude - Client's longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Promise<Array>} Array of nearby drivers
 */
async function findNearbyDrivers(latitude, longitude, radiusKm = 5) {
  try {
    const query = `
      SELECT 
        dp.user_id,
        u.full_name,
        u.phone_number,
        dp.rating_average,
        dp.total_trips,
        dp.profile_photo_url,
        ST_Distance(
          dp.current_location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 AS distance_km,
        ST_Y(dp.current_location::geometry) as latitude,
        ST_X(dp.current_location::geometry) as longitude
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.is_available = true
        AND dp.approval_status = 'approved'
        AND u.status = 'active'
        AND ST_DWithin(
          dp.current_location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        AND dp.last_location_update > NOW() - INTERVAL '10 minutes'
      ORDER BY distance_km ASC
      LIMIT 20
    `;

    const result = await db.query(query, [
      longitude,
      latitude,
      radiusKm * 1000 // Convert km to meters
    ]);

    return result.rows.map(driver => ({
      id: driver.user_id,
      name: driver.full_name,
      phone: driver.phone_number,
      rating: parseFloat(driver.rating_average),
      total_trips: driver.total_trips,
      profile_photo_url: driver.profile_photo_url,
      distance_km: parseFloat(driver.distance_km).toFixed(1),
      eta_minutes: calculateETA(parseFloat(driver.distance_km)),
      location: {
        latitude: driver.latitude,
        longitude: driver.longitude
      }
    }));

  } catch (error) {
    console.error('Error finding nearby drivers:', error);
    throw error;
  }
}

/**
 * Calculate estimated time of arrival for driver
 * @param {number} distanceKm - Distance to driver in km
 * @returns {number} ETA in minutes
 */
function calculateETA(distanceKm) {
  const averageSpeedKmh = 30; // Urban traffic speed
  const timeHours = distanceKm / averageSpeedKmh;
  return Math.max(Math.round(timeHours * 60), 3); // Minimum 3 minutes
}

/**
 * Update driver's current location
 * @param {string} driverId - Driver's user ID
 * @param {number} latitude - Current latitude
 * @param {number} longitude - Current longitude
 * @returns {Promise<boolean>} Success status
 */
async function updateDriverLocation(driverId, latitude, longitude) {
  try {
    await db.query(
      `UPDATE driver_profiles 
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
           last_location_update = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [longitude, latitude, driverId]
    );
    return true;
  } catch (error) {
    console.error('Error updating driver location:', error);
    return false;
  }
}

/**
 * Check if a location is within a city boundary
 * This is a simplified version - real implementation would use actual city polygons
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
function isWithinServiceArea(latitude, longitude) {
  // Nairobi approximate bounds
  const nairobiBounds = {
    north: -1.163,
    south: -1.444,
    east: 37.103,
    west: 36.651
  };

  return (
    latitude >= nairobiBounds.south &&
    latitude <= nairobiBounds.north &&
    longitude >= nairobiBounds.west &&
    longitude <= nairobiBounds.east
  );
}

/**
 * Validate coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
function validateCoordinates(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Get driver's current location
 * @param {string} driverId
 * @returns {Promise<Object|null>}
 */
async function getDriverLocation(driverId) {
  try {
    const result = await db.query(
      `SELECT 
        ST_Y(current_location::geometry) as latitude,
        ST_X(current_location::geometry) as longitude,
        last_location_update
       FROM driver_profiles
       WHERE user_id = $1`,
      [driverId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row.latitude || !row.longitude) {
      return null;
    }

    return {
      latitude: row.latitude,
      longitude: row.longitude,
      last_updated: row.last_location_update
    };
  } catch (error) {
    console.error('Error getting driver location:', error);
    return null;
  }
}

module.exports = {
  findNearbyDrivers,
  updateDriverLocation,
  isWithinServiceArea,
  validateCoordinates,
  getDriverLocation,
  calculateETA
};
