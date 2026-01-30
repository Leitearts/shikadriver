# SafeDrive Kenya - Designated Driver Platform MVP

![SafeDrive Kenya](https://img.shields.io/badge/version-1.0.0--MVP-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Android-brightgreen)

> A mobile-first designated driver platform connecting Kenyan car owners with verified, licensed drivers who can safely drive clients home in their own vehicles.

## 🎯 Problem Statement

In urban Kenya, many car owners face the challenge of getting home safely after social events where they've consumed alcohol. Traditional taxi services require leaving your vehicle behind, while ride-sharing doesn't allow you to use your own car. SafeDrive solves this by providing verified drivers who come to you and drive your car home.

## ✨ Key Features

### For Clients (Car Owners)
- 📱 Simple phone number registration with OTP
- 📍 GPS-based location selection for pickup and drop-off
- 💰 Transparent pricing before requesting
- 🚗 Real-time driver tracking
- ⭐ Rating and feedback system
- 🆘 Emergency SOS button with instant alerts
- 📊 Trip history and receipts

### For Drivers
- ✅ Document verification system (license, ID, good conduct certificate)
- 📋 Manual admin approval process
- 🟢 Simple online/offline toggle
- 🎯 Instant trip request notifications
- 🗺️ Integrated navigation
- 💵 Transparent earnings tracking
- ⭐ Performance ratings

### For Administrators
- 👥 Driver approval dashboard
- 📈 Real-time trip monitoring
- 🚨 Emergency alert management
- 💳 Pricing configuration
- 🔍 Audit logs and analytics
- 🔒 User account management

## 🏗️ Architecture

```
┌─────────────────────┐
│   Android App       │
│  (React Native)     │
│  - Client Flow      │
│  - Driver Flow      │
└──────────┬──────────┘
           │
           │ HTTPS/WSS
           │
┌──────────▼──────────┐
│   Backend API       │
│   (Node.js)         │
│   - RESTful API     │
│   - Socket.io       │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼────┐
│PostgreSQL│  │ Redis │
│+ PostGIS │  │ Cache │
└─────────┘   └────────┘
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ with PostGIS extension
- **Cache**: Redis 6+
- **Real-time**: Socket.io
- **Authentication**: Firebase Auth (Phone OTP)
- **File Storage**: AWS S3 / Google Cloud Storage
- **API Style**: RESTful with JWT

### Mobile App
- **Framework**: React Native 0.72+
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation 6
- **Maps**: Google Maps SDK for Android
- **Push Notifications**: Firebase Cloud Messaging
- **Real-time**: Socket.io Client

### Admin Dashboard
- **Framework**: React.js 18+
- **UI Library**: Material-UI / Ant Design
- **Charts**: Recharts
- **State**: Redux Toolkit

### DevOps
- **Hosting**: AWS EC2 / Google Cloud Run
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry + LogRocket
- **Analytics**: Mixpanel + Google Analytics

## 📦 Project Structure

```
safedrive-mvp/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Helper functions
│   │   ├── socket/          # Socket.io handlers
│   │   └── server.js        # Entry point
│   ├── migrations/          # Database migrations
│   ├── tests/              # API tests
│   └── package.json
├── mobile/
│   ├── src/
│   │   ├── screens/         # App screens
│   │   ├── components/      # Reusable components
│   │   ├── navigation/      # Navigation setup
│   │   ├── redux/           # State management
│   │   ├── services/        # API & Socket services
│   │   └── utils/           # Helpers
│   ├── android/            # Android native code
│   └── package.json
├── admin/
│   ├── src/
│   │   ├── pages/          # Dashboard pages
│   │   ├── components/     # UI components
│   │   └── services/       # API client
│   └── package.json
└── docs/
    ├── mvp_technical_spec.md
    ├── PROJECT_ROADMAP.md
    ├── QUICKSTART_GUIDE.md
    └── API.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Redis 6+
- Android Studio (for mobile development)
- Firebase account
- Google Maps API key
- AWS/GCP account (for file storage)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/safedrive-mvp.git
cd safedrive-mvp/backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up database
createdb safedrive
psql -d safedrive -c "CREATE EXTENSION postgis;"
npm run migrate

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

### Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Link native dependencies (if needed)
npx react-native link

# Configure Firebase
# 1. Download google-services.json from Firebase Console
# 2. Place in android/app/google-services.json

# Run on Android
npm run android
```

### Admin Dashboard Setup

```bash
cd admin

# Install dependencies
npm install

# Start development server
npm start
```

Dashboard available at `http://localhost:3000`

## 📖 Documentation

- **[MVP Technical Specification](docs/mvp_technical_spec.md)** - Complete technical architecture, database schema, API endpoints
- **[Project Roadmap](docs/PROJECT_ROADMAP.md)** - 12-week development plan with milestones and budget
- **[Quick Start Guide](docs/QUICKSTART_GUIDE.md)** - Detailed setup instructions and deployment guide
- **[API Documentation](docs/API.md)** - Complete API reference with examples

## 💾 Database Schema

### Core Tables

- **users** - All user accounts (clients, drivers, admins)
- **driver_profiles** - Driver-specific data and documents
- **trips** - Trip records and status
- **trip_locations** - GPS trail during trips
- **ratings** - Trip ratings and feedback
- **pricing_config** - Dynamic pricing rules
- **audit_logs** - All system actions

### Key Features

- **PostGIS** for efficient location queries
- **JSONB** for flexible data storage
- **Indexes** optimized for common queries
- **Foreign keys** for data integrity
- **Audit logging** for all critical actions

## 🔐 Security Features

### Authentication
- Firebase Phone OTP verification
- JWT tokens with 24-hour expiry
- Secure token refresh mechanism
- Rate limiting on auth endpoints

### Driver Verification
- Manual document review by admins
- License and ID cross-referencing
- Good conduct certificate requirement
- Periodic re-verification (every 6 months)

### Trip Safety
- SOS button with instant alerts
- Real-time location tracking
- Trip sharing with emergency contacts
- Automatic trip recording
- In-app masked calling

### Data Protection
- HTTPS/TLS for all API calls
- PII encryption at rest
- Phone number hashing in logs
- GDPR-compliant data handling
- Regular security audits

## 💰 Pricing Model

### Default Configuration
- **Base Price**: KES 300
- **Per Kilometer**: KES 50
- **Night Multiplier** (10pm-6am): 1.5x
- **Weekend Multiplier**: 1.2x
- **Minimum Price**: KES 400

### Example Calculations

| Distance | Time      | Day      | Price      |
|----------|-----------|----------|------------|
| 5 km     | 8:00 PM   | Weekday  | KES 550    |
| 5 km     | 11:00 PM  | Weekday  | KES 825    |
| 5 km     | 2:00 PM   | Saturday | KES 660    |
| 10 km    | 1:00 AM   | Sunday   | KES 1,980  |

*Prices round to nearest KES 10*

## 📊 Success Metrics (MVP Goals)

### User Acquisition
- 50+ verified drivers in first month
- 200+ registered clients in first month
- 30% driver approval rate

### Engagement
- 100+ completed trips in first month
- 60% driver weekly activity rate
- 4.0+ average rating

### Operations
- < 5 minutes average driver response time
- < 10% trip cancellation rate
- < 1% SOS trigger rate
- 95%+ trip completion rate

### Technical
- 99.5% uptime
- < 1% error rate
- < 500ms API response time (p95)

## 🗺️ Development Roadmap

### Phase 1: MVP (Weeks 1-12) ✅ Current
- Core trip functionality
- Driver verification
- Real-time tracking
- Safety features (SOS)
- Rating system
- Admin dashboard
- Android app only
- Cash payments only

### Phase 2: Enhancement (Months 2-4)
- M-Pesa payment integration
- iOS app development
- Driver earnings dashboard
- In-app chat
- Multi-language support (Swahili)

### Phase 3: Scaling (Months 4-6)
- Advanced driver matching
- Dynamic pricing / surge
- Scheduled rides
- Corporate accounts
- Referral system

### Phase 4: Growth (Months 6-12)
- Multi-city expansion
- Driver insurance integration
- API for third-party integrations
- Advanced analytics
- ML-based fraud detection

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage    # Coverage report
```

### Mobile Tests
```bash
cd mobile
npm test                 # Jest tests
npm run test:e2e        # E2E tests (Detox)
```

### Load Testing
```bash
# Using Apache Bench
ab -n 1000 -c 50 http://localhost:3000/api/v1/trips/

# Using Artillery
artillery run load-test.yml
```

## 📱 App Store Deployment

### Google Play Store

1. **Prepare Release**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

2. **Sign Bundle**
   - Use keystore created during setup
   - Generate signed AAB/APK

3. **Upload to Play Console**
   - App name: SafeDrive Kenya
   - Package: com.safedrive.kenya
   - Screenshots (5+ required)
   - Privacy policy URL
   - Content rating

4. **Review & Publish**
   - Submit for review
   - Address feedback
   - Publish to production

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/safedrive
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=your-project
GOOGLE_MAPS_API_KEY=your-key
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
JWT_SECRET=your-secret
SUPPORT_PHONE=+254700000000
```

**Mobile (src/config.js)**
```javascript
export const API_URL = 'https://api.safedrive.ke';
export const GOOGLE_MAPS_API_KEY = 'your-key';
```

## 🐛 Troubleshooting

### Common Issues

**Database connection fails**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify connection string
psql $DATABASE_URL
```

**Maps not showing in app**
```bash
# Verify API key in AndroidManifest.xml
# Check Google Cloud Console billing
# Ensure Maps SDK for Android is enabled
```

**Socket.io not connecting**
```bash
# Check CORS configuration in backend
# Verify firewall allows WebSocket connections
# Check Socket URL in mobile config
```

## 📞 Support

- **Email**: support@safedrive.ke
- **Phone**: +254 700 000000
- **Documentation**: https://docs.safedrive.ke
- **GitHub Issues**: https://github.com/safedrive/mvp/issues

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 👥 Team

- **Product Owner**: [Name]
- **Backend Developer**: [Name]
- **Mobile Developer**: [Name]
- **UI/UX Designer**: [Name]

## 🙏 Acknowledgments

- Firebase for authentication infrastructure
- Google Maps for location services
- PostgreSQL + PostGIS for geospatial queries
- React Native community for mobile framework
- All beta testers and early adopters

## 📈 Metrics & Analytics

### Usage Statistics
View real-time metrics at: `https://analytics.safedrive.ke`

### Key Dashboards
- User acquisition and retention
- Trip volume and completion rates
- Driver performance metrics
- Revenue and pricing analytics
- System performance and errors

## 🔄 Changelog

### Version 1.0.0-MVP (2025-04-30)
- ✨ Initial MVP release
- 🚀 Android app launched
- 🔐 Phone OTP authentication
- 📍 Real-time trip tracking
- 🆘 Emergency SOS feature
- ⭐ Rating system
- 👨‍💼 Admin dashboard

---

**Built with ❤️ for safer roads in Kenya**

*SafeDrive Kenya - Drive Safe, Arrive Safe*
