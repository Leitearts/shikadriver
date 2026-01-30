// backend/src/routes/trips.js
// Trip Management API Endpoints - Implementation Examples

const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const { calculatePrice, calculateDistance } = require('../utils/pricing');
const { findNearbyDrivers } = require('../utils/location');
const { notifyDriver, notifyClient } = require('../utils/notifications');
const db = require('../db');

// Request a new trip
router.post('/request', authenticateToken, requireUserType('client'), async (req, res) => {
  try {
    const { pickup_location, dropoff_location } = req.body;
    const client_id = req.user.id;

    // Validate locations
    if (!pickup_location?.latitude || !pickup_location?.longitude ||
        !dropoff_location?.latitude || !dropoff_location?.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pickup or dropoff location'
      });
    }

    // Calculate distance and price
    const distance = calculateDistance(
      pickup_location.latitude,
      pickup_location.longitude,
      dropoff_location.latitude,
      dropoff_location.longitude
    );

    const pricingConfig = await db.query(
      'SELECT * FROM pricing_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );

    const estimatedPrice = calculatePrice(distance, new Date(), pricingConfig.rows[0]);
    const estimatedDuration = Math.round(distance / 0.6); // Assume 36 km/h average speed

    // Create trip
    const tripResult = await db.query(
      `INSERT INTO trips (
        client_id, 
        pickup_location, 
        pickup_address,
        dropoff_location,
        dropoff_address,
        estimated_distance_km,
        estimated_duration_min,
        estimated_price,
        status
      ) VALUES (
        $1,
        ST_SetSRID(ST_MakePoint($2, $3), 4326),
        $4,
        ST_SetSRID(ST_MakePoint($5, $6), 4326),
        $7,
        $8,
        $9,
        $10,
        'pending'
      ) RETURNING id, estimated_price, estimated_distance_km, estimated_duration_min`,
      [
        client_id,
        pickup_location.longitude,
        pickup_location.latitude,
        pickup_location.address,
        dropoff_location.longitude,
        dropoff_location.latitude,
        dropoff_location.address,
        distance,
        estimatedDuration,
        estimatedPrice
      ]
    );

    const trip = tripResult.rows[0];

    // Find nearby available drivers
    const nearbyDrivers = await findNearbyDrivers(
      pickup_location.latitude,
      pickup_location.longitude,
      5 // 5km radius
    );

    // Notify nearby drivers
    nearbyDrivers.forEach(driver => {
      notifyDriver(driver.user_id, 'new_trip_request', {
        trip_id: trip.id,
        pickup_location,
        dropoff_location,
        estimated_price: trip.estimated_price
      });
    });

    // Log action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        client_id,
        'trip_requested',
        'trip',
        trip.id,
        JSON.stringify({ pickup_location, dropoff_location }),
        req.ip
      ]
    );

    res.json({
      success: true,
      trip_id: trip.id,
      estimated_price: parseFloat(trip.estimated_price),
      estimated_distance_km: parseFloat(trip.estimated_distance_km),
      estimated_duration_min: trip.estimated_duration_min,
      available_drivers_count: nearbyDrivers.length
    });

  } catch (error) {
    console.error('Trip request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trip request'
    });
  }
});

// Accept a trip (driver)
router.post('/:trip_id/accept', authenticateToken, requireUserType('driver'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { trip_id } = req.params;
    const driver_id = req.user.id;

    // Check if driver is approved and available
    const driverCheck = await client.query(
      `SELECT approval_status, is_available 
       FROM driver_profiles 
       WHERE user_id = $1`,
      [driver_id]
    );

    if (!driverCheck.rows[0] || 
        driverCheck.rows[0].approval_status !== 'approved' ||
        !driverCheck.rows[0].is_available) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: 'Driver not approved or not available'
      });
    }

    // Try to accept the trip (only if still pending)
    const updateResult = await client.query(
      `UPDATE trips 
       SET driver_id = $1, 
           status = 'accepted',
           accepted_at = CURRENT_TIMESTAMP
       WHERE id = $2 
         AND status = 'pending'
       RETURNING *`,
      [driver_id, trip_id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Trip already accepted by another driver or cancelled'
      });
    }

    const trip = updateResult.rows[0];

    // Mark driver as unavailable
    await client.query(
      'UPDATE driver_profiles SET is_available = false WHERE user_id = $1',
      [driver_id]
    );

    // Get client details
    const clientResult = await client.query(
      'SELECT full_name, phone_number FROM users WHERE id = $1',
      [trip.client_id]
    );

    await client.query('COMMIT');

    // Notify client
    notifyClient(trip.client_id, 'trip_accepted', {
      trip_id: trip.id,
      driver_id: driver_id
    });

    // Log action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [driver_id, 'trip_accepted', 'trip', trip.id, JSON.stringify({}), req.ip]
    );

    res.json({
      success: true,
      trip: {
        id: trip.id,
        client_name: clientResult.rows[0].full_name,
        client_phone: clientResult.rows[0].phone_number,
        pickup_location: {
          address: trip.pickup_address,
          // Convert PostGIS to lat/lng (simplified)
        },
        dropoff_location: {
          address: trip.dropoff_address,
        },
        estimated_price: parseFloat(trip.estimated_price)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Trip accept error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept trip'
    });
  } finally {
    client.release();
  }
});

// Update trip status
router.patch('/:trip_id/status', authenticateToken, async (req, res) => {
  try {
    const { trip_id } = req.params;
    const { status } = req.body;
    const user_id = req.user.id;

    // Validate status transition
    const validStatuses = ['driver_arriving', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_driver'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Check authorization (client or driver of this trip)
    const authCheck = await db.query(
      'SELECT client_id, driver_id, status as current_status FROM trips WHERE id = $1',
      [trip_id]
    );

    if (authCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const trip = authCheck.rows[0];
    if (trip.client_id !== user_id && trip.driver_id !== user_id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Update status
    const updateFields = { status };
    if (status === 'in_progress') {
      updateFields.started_at = 'CURRENT_TIMESTAMP';
    } else if (status === 'completed') {
      updateFields.completed_at = 'CURRENT_TIMESTAMP';
    } else if (status.includes('cancelled')) {
      updateFields.cancelled_at = 'CURRENT_TIMESTAMP';
    }

    const setClause = Object.keys(updateFields)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');

    const values = [trip_id, ...Object.values(updateFields)];

    const updateResult = await db.query(
      `UPDATE trips SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      values
    );

    const updatedTrip = updateResult.rows[0];

    // If completed or cancelled, make driver available again
    if (status === 'completed' || status.includes('cancelled')) {
      await db.query(
        'UPDATE driver_profiles SET is_available = true WHERE user_id = $1',
        [trip.driver_id]
      );
    }

    // Notify the other party
    const notifyUserId = user_id === trip.client_id ? trip.driver_id : trip.client_id;
    if (notifyUserId) {
      notifyDriver(notifyUserId, 'trip_status_change', {
        trip_id,
        status
      });
    }

    // Log action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, 'trip_status_updated', 'trip', trip_id, JSON.stringify({ status }), req.ip]
    );

    res.json({
      success: true,
      trip: updatedTrip
    });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trip status'
    });
  }
});

// Update location during trip (driver only)
router.post('/:trip_id/location', authenticateToken, requireUserType('driver'), async (req, res) => {
  try {
    const { trip_id } = req.params;
    const { latitude, longitude, speed_kmh, heading } = req.body;
    const driver_id = req.user.id;

    // Verify this is the driver's active trip
    const tripCheck = await db.query(
      'SELECT id FROM trips WHERE id = $1 AND driver_id = $2 AND status = $3',
      [trip_id, driver_id, 'in_progress']
    );

    if (tripCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized or trip not in progress'
      });
    }

    // Store location
    await db.query(
      `INSERT INTO trip_locations (trip_id, location, speed_kmh, heading)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5)`,
      [trip_id, longitude, latitude, speed_kmh, heading]
    );

    // Broadcast location via Socket.io
    const io = req.app.get('io');
    io.to(`trip_${trip_id}`).emit('driver_location_update', {
      latitude,
      longitude,
      speed_kmh,
      heading,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update location'
    });
  }
});

// Trigger SOS
router.post('/:trip_id/sos', authenticateToken, async (req, res) => {
  try {
    const { trip_id } = req.params;
    const { current_location } = req.body;
    const user_id = req.user.id;

    // Update trip with SOS flag
    await db.query(
      `UPDATE trips 
       SET sos_triggered = true, 
           sos_triggered_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [trip_id]
    );

    // Get trip details for emergency notification
    const tripDetails = await db.query(
      `SELECT t.*, 
              c.full_name as client_name, c.phone_number as client_phone,
              d.full_name as driver_name, d.phone_number as driver_phone
       FROM trips t
       JOIN users c ON t.client_id = c.id
       LEFT JOIN users d ON t.driver_id = d.id
       WHERE t.id = $1`,
      [trip_id]
    );

    const trip = tripDetails.rows[0];

    // Send emergency notifications
    // 1. Notify admin dashboard
    const io = req.app.get('io');
    io.to('admin').emit('sos_alert', {
      trip_id,
      triggered_by: user_id,
      current_location,
      trip_details: trip,
      timestamp: new Date().toISOString()
    });

    // 2. Send SMS to support team (implementation depends on SMS provider)
    // sendEmergencySMS(trip, current_location);

    // 3. Log emergency
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user_id,
        'sos_triggered',
        'trip',
        trip_id,
        JSON.stringify({ current_location }),
        req.ip
      ]
    );

    res.json({
      success: true,
      message: 'Emergency alert sent to support team',
      support_number: process.env.SUPPORT_PHONE
    });

  } catch (error) {
    console.error('SOS error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger SOS'
    });
  }
});

// Get trip history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const isDriver = req.user.user_type === 'driver';
    const userField = isDriver ? 'driver_id' : 'client_id';

    const result = await db.query(
      `SELECT t.*,
              c.full_name as client_name,
              d.full_name as driver_name,
              r.rating, r.feedback
       FROM trips t
       JOIN users c ON t.client_id = c.id
       LEFT JOIN users d ON t.driver_id = d.id
       LEFT JOIN ratings r ON t.id = r.trip_id
       WHERE t.${userField} = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM trips WHERE ${userField} = $1`,
      [user_id]
    );

    res.json({
      success: true,
      trips: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Trip history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trip history'
    });
  }
});

module.exports = router;
