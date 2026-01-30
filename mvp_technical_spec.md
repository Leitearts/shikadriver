# SafeDrive Kenya - MVP Technical Specification

## Executive Summary

SafeDrive is a mobile-first designated driver platform connecting Kenyan car owners with verified drivers who can safely drive clients home in their own vehicles. This document outlines the technical architecture, features, and implementation roadmap for the MVP.

## 1. System Architecture

### 1.1 Technology Stack

**Mobile Application (Android)**
- **Framework**: React Native (cross-platform ready for future iOS)
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation
- **Maps**: Google Maps SDK for Android
- **Real-time Updates**: Firebase Cloud Messaging
- **Local Storage**: AsyncStorage / SQLite

**Backend**
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL (primary) + Redis (caching/sessions)
- **File Storage**: AWS S3 or Google Cloud Storage
- **Real-time**: Socket.io for live tracking
- **Authentication**: Firebase Auth (phone OTP)
- **API**: RESTful with JWT tokens

**Admin Dashboard**
- **Framework**: React.js
- **UI Library**: Material-UI or Ant Design
- **State Management**: Redux Toolkit
- **Hosting**: Vercel or Netlify

**Infrastructure**
- **Hosting**: AWS EC2 or Google Cloud Run
- **CDN**: CloudFlare
- **Monitoring**: Sentry (errors) + LogRocket (sessions)
- **Analytics**: Google Analytics + Mixpanel

### 1.2 High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Android App    │◄───────►│   Backend API    │◄───────►│ Admin Dashboard │
│  (Client/Driver)│         │   (Node.js)      │         │   (React Web)   │
│                 │         │                  │         │                 │
└────────┬────────┘         └────────┬─────────┘         └─────────────────┘
         │                           │
         │                           │
         │                  ┌────────▼─────────┐
         │                  │                  │
         │                  │   PostgreSQL     │
         │                  │   (Main DB)      │
         │                  │                  │
         │                  └──────────────────┘
         │                           │
         │                  ┌────────▼─────────┐
         │                  │                  │
         └─────────────────►│   Firebase       │
                            │   (Auth + FCM)   │
                            │                  │
                            └──────────────────┘
```

## 2. Database Schema

### 2.1 Core Tables

**users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    firebase_uid VARCHAR(128) UNIQUE,
    user_type ENUM('client', 'driver', 'admin') NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**driver_profiles**
```sql
CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    id_number VARCHAR(50) UNIQUE NOT NULL,
    license_photo_url TEXT,
    id_photo_url TEXT,
    good_conduct_cert_url TEXT,
    profile_photo_url TEXT,
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    is_available BOOLEAN DEFAULT false,
    current_location GEOGRAPHY(POINT, 4326),
    last_location_update TIMESTAMP,
    rating_average DECIMAL(3,2) DEFAULT 0.00,
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**trips**
```sql
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES users(id) NOT NULL,
    driver_id UUID REFERENCES users(id),
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_address TEXT NOT NULL,
    estimated_distance_km DECIMAL(6,2),
    estimated_duration_min INTEGER,
    estimated_price DECIMAL(8,2),
    final_price DECIMAL(8,2),
    status ENUM(
        'pending',
        'accepted',
        'driver_arriving',
        'in_progress',
        'completed',
        'cancelled_by_client',
        'cancelled_by_driver'
    ) DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    sos_triggered BOOLEAN DEFAULT false,
    sos_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**trip_locations** (for live tracking)
```sql
CREATE TABLE trip_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    speed_kmh DECIMAL(5,2),
    heading DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trip_locations_trip ON trip_locations(trip_id, recorded_at DESC);
```

**ratings**
```sql
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) UNIQUE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    feedback TEXT,
    rated_by UUID REFERENCES users(id) NOT NULL,
    rated_user UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**pricing_config** (admin adjustable)
```sql
CREATE TABLE pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_price DECIMAL(8,2) DEFAULT 300.00,
    price_per_km DECIMAL(6,2) DEFAULT 50.00,
    night_multiplier DECIMAL(3,2) DEFAULT 1.5,  -- 10pm-6am
    weekend_multiplier DECIMAL(3,2) DEFAULT 1.2,
    minimum_price DECIMAL(8,2) DEFAULT 400.00,
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**audit_logs**
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

### 2.2 Indexes for Performance

```sql
-- User lookups
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_type ON users(user_type, status);

-- Driver availability queries
CREATE INDEX idx_drivers_available ON driver_profiles(is_available, approval_status) 
    WHERE is_available = true AND approval_status = 'approved';
CREATE INDEX idx_drivers_location ON driver_profiles USING GIST(current_location);

-- Trip queries
CREATE INDEX idx_trips_client ON trips(client_id, created_at DESC);
CREATE INDEX idx_trips_driver ON trips(driver_id, created_at DESC);
CREATE INDEX idx_trips_status ON trips(status, requested_at DESC);
```

## 3. API Endpoints

### 3.1 Authentication

**POST** `/api/v1/auth/send-otp`
```json
Request:
{
  "phone_number": "+254712345678"
}

Response:
{
  "success": true,
  "message": "OTP sent successfully",
  "verification_id": "abc123..."
}
```

**POST** `/api/v1/auth/verify-otp`
```json
Request:
{
  "phone_number": "+254712345678",
  "otp_code": "123456",
  "verification_id": "abc123..."
}

Response:
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "phone_number": "+254712345678",
    "user_type": "client",
    "full_name": "John Doe"
  }
}
```

**POST** `/api/v1/auth/register`
```json
Request:
{
  "phone_number": "+254712345678",
  "full_name": "John Doe",
  "email": "john@example.com",
  "user_type": "client"
}

Response:
{
  "success": true,
  "user_id": "uuid",
  "message": "Registration successful"
}
```

### 3.2 Driver Onboarding

**POST** `/api/v1/drivers/onboard`
```json
Request (multipart/form-data):
{
  "license_number": "DL123456",
  "id_number": "12345678",
  "license_photo": <file>,
  "id_photo": <file>,
  "good_conduct_cert": <file>,
  "profile_photo": <file>
}

Response:
{
  "success": true,
  "profile_id": "uuid",
  "approval_status": "pending",
  "message": "Documents submitted for review"
}
```

**GET** `/api/v1/drivers/profile`
```json
Response:
{
  "id": "uuid",
  "license_number": "DL123456",
  "approval_status": "approved",
  "is_available": false,
  "rating_average": 4.8,
  "total_trips": 42
}
```

**PATCH** `/api/v1/drivers/availability`
```json
Request:
{
  "is_available": true,
  "current_location": {
    "latitude": -1.286389,
    "longitude": 36.817223
  }
}

Response:
{
  "success": true,
  "is_available": true
}
```

### 3.3 Trip Management

**POST** `/api/v1/trips/request`
```json
Request:
{
  "pickup_location": {
    "latitude": -1.286389,
    "longitude": 36.817223,
    "address": "Westlands, Nairobi"
  },
  "dropoff_location": {
    "latitude": -1.292066,
    "longitude": 36.821945,
    "address": "Kilimani, Nairobi"
  }
}

Response:
{
  "success": true,
  "trip_id": "uuid",
  "estimated_price": 800.00,
  "estimated_distance_km": 5.2,
  "estimated_duration_min": 15,
  "available_drivers_count": 3
}
```

**GET** `/api/v1/trips/available-drivers?latitude=-1.286389&longitude=36.817223&radius_km=5`
```json
Response:
{
  "drivers": [
    {
      "id": "uuid",
      "name": "Jane Driver",
      "rating": 4.9,
      "total_trips": 150,
      "distance_km": 2.3,
      "eta_minutes": 8,
      "profile_photo_url": "https://..."
    }
  ]
}
```

**POST** `/api/v1/trips/{trip_id}/accept` (Driver)
```json
Response:
{
  "success": true,
  "trip": {
    "id": "uuid",
    "client_name": "John Doe",
    "client_phone": "+254712345678",
    "pickup_location": {...},
    "dropoff_location": {...}
  }
}
```

**PATCH** `/api/v1/trips/{trip_id}/status`
```json
Request:
{
  "status": "in_progress"
}

Response:
{
  "success": true,
  "trip": {...}
}
```

**POST** `/api/v1/trips/{trip_id}/location` (Driver - during trip)
```json
Request:
{
  "latitude": -1.287000,
  "longitude": 36.818000,
  "speed_kmh": 45.5,
  "heading": 180.0
}

Response:
{
  "success": true
}
```

**POST** `/api/v1/trips/{trip_id}/complete`
```json
Request:
{
  "final_price": 850.00
}

Response:
{
  "success": true,
  "trip": {
    "id": "uuid",
    "final_price": 850.00,
    "status": "completed"
  }
}
```

**POST** `/api/v1/trips/{trip_id}/sos`
```json
Request:
{
  "current_location": {
    "latitude": -1.287000,
    "longitude": 36.818000
  }
}

Response:
{
  "success": true,
  "message": "Emergency alert sent to support team",
  "support_number": "+254700000000"
}
```

### 3.4 Ratings

**POST** `/api/v1/ratings`
```json
Request:
{
  "trip_id": "uuid",
  "rating": 5,
  "feedback": "Excellent service, very professional"
}

Response:
{
  "success": true,
  "rating_id": "uuid"
}
```

### 3.5 Admin Endpoints

**GET** `/api/v1/admin/drivers/pending`
```json
Response:
{
  "drivers": [
    {
      "id": "uuid",
      "full_name": "Jane Driver",
      "phone_number": "+254722222222",
      "license_number": "DL123456",
      "documents": {
        "license_photo_url": "https://...",
        "id_photo_url": "https://...",
        "good_conduct_cert_url": "https://...",
        "profile_photo_url": "https://..."
      },
      "submitted_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**PATCH** `/api/v1/admin/drivers/{driver_id}/approve`
```json
Request:
{
  "approved": true,
  "rejection_reason": null
}

Response:
{
  "success": true,
  "driver": {
    "id": "uuid",
    "approval_status": "approved"
  }
}
```

**GET** `/api/v1/admin/trips?status=active&page=1&limit=20`
```json
Response:
{
  "trips": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145
  }
}
```

**PATCH** `/api/v1/admin/users/{user_id}/suspend`
```json
Request:
{
  "suspended": true,
  "reason": "Multiple complaints"
}

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "status": "suspended"
  }
}
```

**PATCH** `/api/v1/admin/pricing`
```json
Request:
{
  "base_price": 350.00,
  "price_per_km": 55.00,
  "night_multiplier": 1.5,
  "weekend_multiplier": 1.3,
  "minimum_price": 450.00
}

Response:
{
  "success": true,
  "pricing_config": {...}
}
```

## 4. Mobile App Screens

### 4.1 Client Flow

1. **Splash Screen** → Check auth status
2. **Login/Register** → Phone + OTP verification
3. **Home Screen**
   - Map view with current location
   - "Request Driver" button
   - Recent trips list
4. **Request Driver**
   - Pick pickup location (map + search)
   - Pick dropoff location (map + search)
   - View estimated price
   - Confirm request button
5. **Searching for Driver**
   - Loading animation
   - "Cancel request" option
6. **Driver Matched**
   - Driver details (name, photo, rating)
   - Driver's current location on map
   - ETA to pickup
   - Contact driver button
7. **Trip in Progress**
   - Live map with route
   - Current location tracking
   - SOS button (prominent)
   - Trip details (time, distance)
8. **Trip Complete**
   - Final price
   - Payment method (cash)
   - Rate driver (1-5 stars + feedback)
9. **Profile**
   - Personal info
   - Trip history
   - Support/Help
   - Logout

### 4.2 Driver Flow

1. **Splash Screen** → Check auth status
2. **Login/Register** → Phone + OTP
3. **Onboarding** (first time only)
   - Upload license photo
   - Upload ID photo
   - Upload good conduct certificate
   - Upload profile photo
   - Submit for approval
4. **Pending Approval**
   - "Under Review" message
   - Refresh status button
5. **Home Screen** (post-approval)
   - Toggle availability (Online/Offline)
   - Current location map
   - Today's earnings summary
   - Recent trips
6. **New Trip Request**
   - Client details
   - Pickup and dropoff locations
   - Estimated price
   - Accept/Decline buttons
7. **Navigate to Client**
   - Map with route to pickup
   - Client contact button
   - "Arrived" button
8. **Trip in Progress**
   - Map with route
   - "Start Trip" button (when client ready)
   - Trip timer
   - Navigation
9. **Complete Trip**
   - "End Trip" button
   - Final price confirmation
   - Rate client option
10. **Profile**
    - Earnings stats
    - Trip history
    - Documents/verification status
    - Support
    - Logout

### 4.3 UI/UX Guidelines

**Design Principles**
- Clean, minimal interface
- High contrast for outdoor visibility
- Large touch targets (minimum 44x44 dp)
- Clear status indicators
- Offline-friendly where possible

**Color Scheme**
- Primary: Kenyan flag colors (Red, Green, Black)
- Accent: Gold/Yellow
- Status: Green (active), Red (emergency), Blue (info)

**Typography**
- System fonts for accessibility
- Clear hierarchy (headings, body, captions)
- Minimum 14sp for body text

## 5. Security & Safety Features

### 5.1 Driver Verification
- Manual admin review of all documents
- Cross-reference license and ID numbers
- Good conduct certificate validation
- Profile photo for client recognition
- Periodic re-verification (every 6 months)

### 5.2 Trip Safety
- SOS button triggers:
  - Immediate alert to admin dashboard
  - SMS to emergency contact
  - Trip location logged every 10 seconds
  - Driver suspension pending investigation
- Trip sharing: Client can share live trip link
- In-app calling (masked numbers)
- Automatic trip recording (GPS trail)

### 5.3 Data Security
- All API calls over HTTPS
- JWT tokens with 24-hour expiry
- Phone numbers hashed in logs
- PII encrypted at rest
- GDPR-compliant data handling
- Regular security audits

### 5.4 Fraud Prevention
- One phone number per account
- Driver license uniqueness check
- Rate limiting on API endpoints
- Suspicious pattern detection (admin alerts)
- Trip cancellation limits

## 6. Pricing Logic

### 6.1 Base Calculation

```javascript
function calculatePrice(distanceKm, requestTime, config) {
  // Base price
  let price = config.base_price;
  
  // Add distance cost
  price += distanceKm * config.price_per_km;
  
  // Night multiplier (10pm - 6am)
  const hour = requestTime.getHours();
  if (hour >= 22 || hour < 6) {
    price *= config.night_multiplier;
  }
  
  // Weekend multiplier (Sat-Sun)
  const day = requestTime.getDay();
  if (day === 0 || day === 6) {
    price *= config.weekend_multiplier;
  }
  
  // Apply minimum price
  price = Math.max(price, config.minimum_price);
  
  // Round to nearest 10 KES
  return Math.round(price / 10) * 10;
}
```

### 6.2 Default Pricing

- Base price: KES 300
- Per kilometer: KES 50
- Night multiplier (10pm-6am): 1.5x
- Weekend multiplier: 1.2x
- Minimum price: KES 400

### 6.3 Example Calculations

| Distance | Time | Day | Price |
|----------|------|-----|-------|
| 5 km | 8pm | Weekday | KES 550 |
| 5 km | 11pm | Weekday | KES 825 (night) |
| 5 km | 2pm | Saturday | KES 660 (weekend) |
| 10 km | 1am | Sunday | KES 1,980 (night + weekend) |

## 7. Real-Time Features

### 7.1 Driver Location Updates

**Client → Server**
- Driver sends location every 10 seconds when available
- Server updates `driver_profiles.current_location`
- Server broadcasts to nearby clients via Socket.io

**Server → Client**
- Clients subscribe to driver locations in their radius
- Receive updates in real-time on map

### 7.2 Trip Tracking

**Driver → Server**
- Location updates every 5 seconds during active trip
- Stored in `trip_locations` table
- Broadcasted to client via Socket.io

**Server → Client**
- Client receives driver location on map
- ETA calculations updated
- Route polyline drawn

### 7.3 Socket.io Events

```javascript
// Client events
socket.on('driver_location_update', (data) => {
  // Update driver marker on map
});

socket.on('trip_accepted', (data) => {
  // Navigate to "Driver Matched" screen
});

socket.on('trip_status_change', (data) => {
  // Update UI based on status
});

// Driver events
socket.on('new_trip_request', (data) => {
  // Show trip request modal
});

socket.on('trip_cancelled', (data) => {
  // Return to home screen
});
```

## 8. Admin Dashboard

### 8.1 Key Screens

1. **Dashboard Overview**
   - Active trips count
   - Drivers online count
   - Pending driver approvals
   - Today's revenue
   - Alerts (SOS, suspicious activity)

2. **Driver Management**
   - Pending approvals table
   - Document viewer
   - Approve/Reject actions
   - Active drivers list
   - Suspended drivers

3. **Trip Management**
   - Real-time trip map
   - Trip history table
   - Search/filter (date, driver, client, status)
   - Trip details modal

4. **User Management**
   - Client list
   - Driver list
   - Search by phone/name
   - Suspend/Reactivate actions
   - View trip history

5. **Pricing Configuration**
   - Current pricing display
   - Edit pricing form
   - Pricing history

6. **Audit Logs**
   - All admin actions logged
   - Filterable by user, action type, date
   - Export to CSV

### 8.2 Dashboard Access Control

```javascript
// Role-based permissions
const permissions = {
  super_admin: ['*'], // All permissions
  admin: [
    'drivers.approve',
    'drivers.suspend',
    'trips.view',
    'users.suspend',
    'pricing.edit'
  ],
  support: [
    'drivers.view',
    'trips.view',
    'users.view'
  ]
};
```

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Backend**
- [ ] Set up Node.js + Express server
- [ ] Configure PostgreSQL database
- [ ] Create database schema and migrations
- [ ] Set up Firebase Auth for OTP
- [ ] Implement authentication endpoints
- [ ] Set up file upload to cloud storage
- [ ] Basic error handling and logging

**Mobile**
- [ ] Initialize React Native project
- [ ] Set up navigation structure
- [ ] Create splash screen
- [ ] Implement login/register screens
- [ ] Integrate Firebase Auth OTP
- [ ] Test authentication flow

### Phase 2: Driver Onboarding (Week 3)

**Backend**
- [ ] Driver onboarding endpoints
- [ ] File upload handling
- [ ] Driver profile CRUD operations
- [ ] Approval workflow

**Mobile**
- [ ] Driver onboarding screens
- [ ] Document upload UI
- [ ] Camera integration
- [ ] Pending approval screen
- [ ] Test full driver registration

**Admin**
- [ ] Basic dashboard layout
- [ ] Driver approval screen
- [ ] Document viewer
- [ ] Approve/Reject functionality

### Phase 3: Core Trip Flow (Week 4-5)

**Backend**
- [ ] Trip request endpoint
- [ ] Driver matching logic
- [ ] Trip acceptance endpoint
- [ ] Trip status updates
- [ ] Pricing calculation
- [ ] Real-time location storage

**Mobile - Client**
- [ ] Home screen with map
- [ ] Location search integration
- [ ] Request driver flow
- [ ] Driver matching screen
- [ ] Trip tracking screen
- [ ] Trip completion screen

**Mobile - Driver**
- [ ] Driver home screen
- [ ] Availability toggle
- [ ] Trip request notification
- [ ] Accept/Decline flow
- [ ] Navigation to pickup
- [ ] Trip in progress screen
- [ ] Complete trip flow

### Phase 4: Real-Time Features (Week 6)

**Backend**
- [ ] Set up Socket.io server
- [ ] Implement location broadcasting
- [ ] Trip status events
- [ ] Driver availability events

**Mobile**
- [ ] Integrate Socket.io client
- [ ] Real-time driver location on map
- [ ] Live trip tracking
- [ ] Push notifications (FCM)
- [ ] Background location updates

### Phase 5: Safety & Ratings (Week 7)

**Backend**
- [ ] SOS endpoint and alerts
- [ ] Rating endpoints
- [ ] Emergency contact notifications
- [ ] Trip sharing links

**Mobile**
- [ ] SOS button implementation
- [ ] Rating screen
- [ ] Trip sharing feature
- [ ] In-app calling
- [ ] Emergency contact setup

**Admin**
- [ ] SOS alert dashboard
- [ ] Real-time trip monitoring
- [ ] Emergency response workflow

### Phase 6: Admin Features (Week 8)

**Admin**
- [ ] Trip management screen
- [ ] User management screen
- [ ] Pricing configuration
- [ ] Audit logs viewer
- [ ] Analytics dashboard
- [ ] Export functionality

**Backend**
- [ ] Admin analytics endpoints
- [ ] Audit logging
- [ ] User suspension logic
- [ ] Pricing configuration API

### Phase 7: Testing & Refinement (Week 9-10)

- [ ] End-to-end testing (all flows)
- [ ] Load testing (concurrent users)
- [ ] Security audit
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Documentation

### Phase 8: Pre-Launch (Week 11-12)

- [ ] Beta testing with real users
- [ ] Feedback incorporation
- [ ] Final security review
- [ ] App store preparation (Google Play)
- [ ] Support documentation
- [ ] Training materials for drivers
- [ ] Launch plan

## 10. Non-Functional Requirements

### 10.1 Performance
- API response time: < 500ms (p95)
- App launch time: < 3 seconds
- Location update latency: < 2 seconds
- Map load time: < 2 seconds
- Support 100 concurrent trips

### 10.2 Reliability
- 99.5% uptime
- Automated backups (daily)
- Graceful degradation (offline mode)
- Error recovery mechanisms
- Health monitoring

### 10.3 Scalability
- Horizontal scaling for API servers
- Database connection pooling
- Redis caching for hot data
- CDN for static assets
- Load balancer ready

### 10.4 Monitoring
- Server metrics (CPU, memory, disk)
- API endpoint metrics
- Error tracking (Sentry)
- User analytics (Mixpanel)
- Database query performance
- Alert system for critical issues

## 11. Testing Strategy

### 11.1 Unit Tests
- API endpoint logic
- Pricing calculations
- Authentication flows
- Database queries

### 11.2 Integration Tests
- End-to-end user flows
- Payment processing
- Real-time updates
- File uploads

### 11.3 Manual Testing Checklist
- [ ] Client registration
- [ ] Driver registration and approval
- [ ] Trip request and matching
- [ ] Real-time tracking
- [ ] Trip completion
- [ ] Rating system
- [ ] SOS functionality
- [ ] Admin actions
- [ ] Edge cases (network loss, GPS issues)

### 11.4 Load Testing
- Simulate 50+ concurrent trip requests
- Test driver availability queries under load
- Real-time event broadcasting stress test

## 12. Deployment

### 12.1 Environment Setup

**Development**
- Local PostgreSQL
- Local Redis
- ngrok for testing webhooks

**Staging**
- AWS RDS PostgreSQL
- ElastiCache Redis
- EC2 instance
- Test data

**Production**
- AWS RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis
- EC2 Auto Scaling Group
- CloudFront CDN
- Production data

### 12.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2
        run: |
          # SSH and deploy
```

### 12.3 Mobile App Release

**Google Play Store**
- App name: SafeDrive Kenya
- Package: com.safedrive.kenya
- Version: 1.0.0 (MVP)
- Minimum SDK: 24 (Android 7.0)
- Target SDK: 34 (Android 14)

**Release checklist**
- [ ] App icons (all sizes)
- [ ] Screenshots (5+ required)
- [ ] App description
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Content rating
- [ ] Signed APK/AAB

## 13. Success Metrics

### 13.1 KPIs for MVP

**User Acquisition**
- 50+ verified drivers in first month
- 200+ registered clients in first month
- 30% driver approval rate

**Engagement**
- 100+ completed trips in first month
- 60% driver weekly activity rate
- 4.0+ average rating

**Operations**
- < 5 minutes average driver response time
- < 10% trip cancellation rate
- < 1% SOS trigger rate
- 95%+ trip completion rate

**Technical**
- 99.5% uptime
- < 1% error rate
- < 500ms API response time

## 14. Known Limitations & Future Enhancements

### 14.1 MVP Limitations
- Cash only (no in-app payments)
- Android only (no iOS)
- Single city (Nairobi)
- Manual pricing adjustments
- Basic matching algorithm (nearest driver)
- No driver incentives/bonuses
- No referral system

### 14.2 Post-MVP Features
- M-Pesa integration
- iOS app
- Multi-city support
- Dynamic pricing / surge
- Advanced driver matching (rating, preferences)
- Driver earnings dashboard
- Client favorite drivers
- Scheduled rides
- Corporate accounts
- Driver insurance integration
- In-app chat
- Multi-language support

## 15. Support & Maintenance

### 15.1 Support Channels
- In-app support button
- WhatsApp business number
- Email support
- Phone hotline (for emergencies)

### 15.2 Documentation
- User guide (client)
- Driver handbook
- Admin manual
- API documentation
- Deployment guide

### 15.3 Maintenance Schedule
- Daily: Backup verification, error log review
- Weekly: Performance analysis, user feedback review
- Monthly: Security updates, dependency updates
- Quarterly: Feature releases, major updates

## 16. Budget Estimate

### 16.1 Development Costs (12 weeks)
- Backend Developer: $5,000
- Mobile Developer: $5,000
- UI/UX Designer: $1,500
- QA/Testing: $1,000
**Total Development: ~$12,500**

### 16.2 Monthly Operating Costs
- AWS/GCP Hosting: $150
- Database: $100
- Firebase: $50
- File Storage: $30
- Monitoring Tools: $50
- Domain & SSL: $10
**Total Monthly: ~$390**

### 16.3 One-Time Costs
- Google Play Developer Account: $25
- Legal (T&C, Privacy Policy): $500
- App Store Assets: $200
**Total One-Time: ~$725**

## Appendix A: Environment Variables

```bash
# .env.example

# Server
NODE_ENV=production
PORT=3000
API_URL=https://api.safedrive.ke

# Database
DATABASE_URL=postgresql://user:pass@host:5432/safedrive
REDIS_URL=redis://localhost:6379

# Firebase
FIREBASE_API_KEY=xxx
FIREBASE_AUTH_DOMAIN=xxx
FIREBASE_PROJECT_ID=xxx

# Storage
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=safedrive-documents
AWS_REGION=eu-west-1

# Google Maps
GOOGLE_MAPS_API_KEY=xxx

# JWT
JWT_SECRET=xxx
JWT_EXPIRY=24h

# Monitoring
SENTRY_DSN=xxx
MIXPANEL_TOKEN=xxx

# Support
SUPPORT_PHONE=+254700000000
SUPPORT_EMAIL=support@safedrive.ke
```

## Appendix B: Key Libraries

**Backend**
```json
{
  "express": "^4.18.2",
  "pg": "^8.11.0",
  "redis": "^4.6.7",
  "socket.io": "^4.6.1",
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  "multer": "^1.4.5-lts.1",
  "aws-sdk": "^2.1400.0",
  "firebase-admin": "^11.9.3",
  "node-cron": "^3.0.2",
  "@sentry/node": "^7.54.0",
  "winston": "^3.8.2"
}
```

**Mobile**
```json
{
  "react-native": "^0.72.0",
  "react-navigation": "^6.0",
  "@react-native-firebase/auth": "^18.0.0",
  "@react-native-firebase/messaging": "^18.0.0",
  "react-native-maps": "^1.7.0",
  "socket.io-client": "^4.6.1",
  "@react-native-community/geolocation": "^3.0.0",
  "react-native-image-picker": "^5.6.0",
  "redux": "^4.2.1",
  "@reduxjs/toolkit": "^1.9.5",
  "axios": "^1.4.0"
}
```

---

**Document Version:** 1.0
**Last Updated:** January 30, 2025
**Author:** SafeDrive Technical Team
