# SafeDrive Kenya MVP - Quick Start Guide

This guide will help you set up and run the SafeDrive MVP locally for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** (v14 or higher)
- **Redis** (v6 or higher)
- **Android Studio** (for mobile development)
- **Git**

### Accounts Needed

1. **Firebase** (for authentication and push notifications)
   - Create project at https://console.firebase.google.com
   - Enable Phone Authentication
   - Enable Cloud Messaging (FCM)

2. **Google Maps API**
   - Get API key from https://console.cloud.google.com
   - Enable: Maps SDK for Android, Geocoding API, Directions API

3. **AWS/GCP** (for file storage)
   - AWS S3 bucket OR Google Cloud Storage bucket
   - IAM credentials with read/write permissions

## Part 1: Backend Setup

### 1. Clone Repository and Install Dependencies

```bash
# Create project directory
mkdir safedrive-backend
cd safedrive-backend

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express pg redis socket.io jsonwebtoken bcrypt multer aws-sdk firebase-admin dotenv cors helmet express-rate-limit winston
npm install --save-dev nodemon
```

### 2. Database Setup

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE safedrive;

# Connect to database
\c safedrive

# Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
```

Now run the schema from `mvp_technical_spec.md` (Section 2.1).

### 3. Configure Environment Variables

Create `.env` file in backend root:

```bash
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/safedrive
REDIS_URL=redis://localhost:6379

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@firebase.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# AWS S3 (or GCP equivalent)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=safedrive-documents
AWS_REGION=eu-west-1

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRY=24h

# Support
SUPPORT_PHONE=+254700000000
SUPPORT_EMAIL=support@safedrive.ke
```

### 4. Project Structure

Create the following folder structure:

```
safedrive-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── firebase.js
│   │   └── redis.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── drivers.js
│   │   ├── trips.js
│   │   ├── ratings.js
│   │   └── admin.js
│   ├── utils/
│   │   ├── pricing.js
│   │   ├── location.js
│   │   ├── notifications.js
│   │   └── fileUpload.js
│   ├── socket/
│   │   └── index.js
│   └── server.js
├── .env
├── .gitignore
└── package.json
```

### 5. Create Main Server File

**src/server.js:**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');
const ratingRoutes = require('./routes/ratings');
const adminRoutes = require('./routes/admin');

// Import socket handlers
const setupSocketIO = require('./socket');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Configure properly in production
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/ratings', ratingRoutes);
app.use('/api/v1/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO setup
setupSocketIO(io);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`SafeDrive API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, io };
```

### 6. Run the Backend

```bash
# Add to package.json scripts
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}

# Start development server
npm run dev
```

The API should now be running at `http://localhost:3000`

## Part 2: Mobile App Setup

### 1. Create React Native Project

```bash
# Create new React Native project
npx react-native init SafeDriveApp
cd SafeDriveApp

# Install dependencies
npm install @react-navigation/native @react-navigation/stack @react-navigation/drawer
npm install react-native-screens react-native-safe-area-context
npm install react-native-maps
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/messaging
npm install @react-native-community/geolocation
npm install react-native-image-picker
npm install socket.io-client
npm install @reduxjs/toolkit react-redux
npm install axios
npm install react-native-vector-icons
```

### 2. Configure Android

**android/app/build.gradle:**

Add Google Maps API key:

```gradle
defaultConfig {
    ...
    resValue "string", "google_maps_api_key", "YOUR_API_KEY_HERE"
}
```

**android/app/src/main/AndroidManifest.xml:**

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.CAMERA" />
    
    <application>
        <meta-data
            android:name="com.google.android.geo.API_KEY"
            android:value="@string/google_maps_api_key"/>
    </application>
</manifest>
```

### 3. Firebase Configuration

1. Download `google-services.json` from Firebase Console
2. Place it in `android/app/google-services.json`
3. Follow Firebase setup instructions for React Native

### 4. Project Structure

```
SafeDriveApp/
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── client/
│   │   └── driver/
│   ├── screens/
│   │   ├── auth/
│   │   ├── client/
│   │   ├── driver/
│   │   └── shared/
│   ├── redux/
│   │   ├── slices/
│   │   └── store.js
│   ├── services/
│   │   ├── api.js
│   │   ├── socket.js
│   │   └── location.js
│   ├── navigation/
│   │   ├── AppNavigator.js
│   │   ├── ClientNavigator.js
│   │   └── DriverNavigator.js
│   ├── utils/
│   │   ├── constants.js
│   │   └── helpers.js
│   └── config.js
├── android/
├── ios/
└── package.json
```

### 5. Configure API URL

**src/config.js:**

```javascript
export const API_URL = __DEV__ 
  ? 'http://10.0.2.2:3000' // Android emulator
  : 'https://api.safedrive.ke';

export const SOCKET_URL = API_URL;

export const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY';
```

### 6. Run the App

```bash
# Start Metro bundler
npm start

# Run on Android (in separate terminal)
npm run android

# Or build for release
cd android
./gradlew assembleRelease
```

## Part 3: Admin Dashboard Setup

### 1. Create React App

```bash
# Create new React app
npx create-react-app safedrive-admin
cd safedrive-admin

# Install dependencies
npm install @mui/material @emotion/react @emotion/styled
npm install react-router-dom
npm install axios
npm install socket.io-client
npm install recharts
npm install date-fns
```

### 2. Project Structure

```
safedrive-admin/
├── public/
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── Drivers/
│   │   ├── Trips/
│   │   ├── Users/
│   │   └── Layout/
│   ├── pages/
│   │   ├── Login.js
│   │   ├── Dashboard.js
│   │   ├── DriverApproval.js
│   │   ├── TripManagement.js
│   │   └── Settings.js
│   ├── services/
│   │   └── api.js
│   ├── utils/
│   └── App.js
└── package.json
```

### 3. Run Admin Dashboard

```bash
npm start
```

Dashboard will be available at `http://localhost:3000`

## Part 4: Testing

### 1. Create Test Database

```bash
# Create test database
createdb safedrive_test

# Run migrations
psql -U postgres -d safedrive_test -f schema.sql
```

### 2. Test Data

Create seed data for testing:

```sql
-- Create test admin user
INSERT INTO users (phone_number, user_type, full_name, email, firebase_uid)
VALUES ('+254700000001', 'admin', 'Admin User', 'admin@safedrive.ke', 'test-admin-uid');

-- Create test client
INSERT INTO users (phone_number, user_type, full_name, email, firebase_uid)
VALUES ('+254700000002', 'client', 'Test Client', 'client@test.com', 'test-client-uid');

-- Create test driver
INSERT INTO users (phone_number, user_type, full_name, email, firebase_uid)
VALUES ('+254700000003', 'driver', 'Test Driver', 'driver@test.com', 'test-driver-uid');

-- Create default pricing config
INSERT INTO pricing_config (base_price, price_per_km, night_multiplier, weekend_multiplier, minimum_price)
VALUES (300.00, 50.00, 1.5, 1.2, 400.00);
```

### 3. Manual Testing Checklist

- [ ] User registration (client)
- [ ] User registration (driver)
- [ ] Driver document upload
- [ ] Admin driver approval
- [ ] Driver goes online
- [ ] Client requests trip
- [ ] Driver accepts trip
- [ ] Trip tracking
- [ ] Trip completion
- [ ] Rating system
- [ ] SOS functionality

## Part 5: Deployment

### Backend Deployment (AWS EC2 Example)

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib postgis

# Install Redis
sudo apt-get install redis-server

# Clone your repository
git clone https://github.com/yourusername/safedrive-backend.git
cd safedrive-backend

# Install dependencies
npm install

# Set up environment variables
nano .env
# Add production values

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start src/server.js --name safedrive-api
pm2 save
pm2 startup
```

### Mobile App Deployment

**Generate Signed APK:**

```bash
cd android

# Generate keystore (first time only)
keytool -genkeypair -v -storetype PKCS12 -keystore safedrive.keystore -alias safedrive -keyalg RSA -keysize 2048 -validity 10000

# Build release APK
./gradlew assembleRelease

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

**Upload to Google Play:**
1. Create Google Play Developer account
2. Create new app listing
3. Upload APK/AAB
4. Complete store listing
5. Submit for review

## Troubleshooting

### Common Issues

**1. Database connection fails**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection string in .env
```

**2. React Native build fails**
```bash
# Clean build
cd android
./gradlew clean

# Clear cache
cd ..
npm start -- --reset-cache
```

**3. Maps not showing**
```bash
# Verify API key in AndroidManifest.xml
# Check billing is enabled in Google Cloud Console
# Ensure Maps SDK for Android is enabled
```

**4. Socket.io not connecting**
```bash
# Check CORS settings in backend
# Verify Socket URL in mobile config
# Check firewall rules
```

## Production Checklist

Before launching to production:

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS/SSL
- [ ] Configure proper CORS origins
- [ ] Set up automated backups
- [ ] Configure monitoring (Sentry, etc.)
- [ ] Set up logging
- [ ] Enable rate limiting
- [ ] Add input validation
- [ ] Test payment flow (when implemented)
- [ ] Load testing
- [ ] Security audit
- [ ] Privacy policy and terms of service
- [ ] App store assets (screenshots, descriptions)

## Support

For issues or questions:
- Email: dev@safedrive.ke
- Documentation: https://docs.safedrive.ke
- GitHub Issues: https://github.com/safedrive/issues

## License

MIT License - See LICENSE file for details
