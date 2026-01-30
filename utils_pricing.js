// backend/src/utils/pricing.js
// Pricing calculation utilities

/**
 * Calculate price based on distance, time, and pricing configuration
 * @param {number} distanceKm - Distance in kilometers
 * @param {Date} requestTime - Time of trip request
 * @param {Object} config - Pricing configuration
 * @returns {number} Final price in KES
 */
function calculatePrice(distanceKm, requestTime, config) {
  // Base price
  let price = parseFloat(config.base_price);
  
  // Add distance cost
  price += distanceKm * parseFloat(config.price_per_km);
  
  // Night multiplier (10pm - 6am)
  const hour = requestTime.getHours();
  if (hour >= 22 || hour < 6) {
    price *= parseFloat(config.night_multiplier);
  }
  
  // Weekend multiplier (Saturday = 6, Sunday = 0)
  const day = requestTime.getDay();
  if (day === 0 || day === 6) {
    price *= parseFloat(config.weekend_multiplier);
  }
  
  // Apply minimum price
  price = Math.max(price, parseFloat(config.minimum_price));
  
  // Round to nearest 10 KES
  return Math.round(price / 10) * 10;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated time based on distance
 * Assumes average speed of 36 km/h in urban areas
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated time in minutes
 */
function calculateEstimatedTime(distanceKm) {
  const averageSpeedKmh = 36; // Urban speed
  const timeHours = distanceKm / averageSpeedKmh;
  return Math.round(timeHours * 60);
}

module.exports = {
  calculatePrice,
  calculateDistance,
  calculateEstimatedTime
};
