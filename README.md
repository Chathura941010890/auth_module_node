# Auth Module - Authentication & Authorization Microservice

**Developer:** Chathura Jayawardane  
**Email:** chathuraj@inqube.com  

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Database Structure](#database-structure)
- [Authentication System](#authentication-system)
- [Authorization & Permissions](#authorization--permissions)
- [Security Features](#security-features)
- [Configuration & Deployment](#configuration--deployment)
- [API Documentation](#api-documentation)
- [Development Guide](#development-guide)

---

## 🎯 Overview

The Auth Module is a comprehensive authentication and authorization microservice built with Node.js, Express, and Sequelize. It provides secure user management, role-based access control (RBAC), department-based permissions, and integration with Azure AD SSO.

### Key Features
- 🔐 Dual authentication modes (Local & Azure AD SSO)
- 🎫 JWT-based authentication with refresh token support
- 🛡️ Advanced security with rate limiting, account lockout, and Redis-based session management
- 👥 Multi-tenant user management with roles, departments, customers, and factories
- 📊 Comprehensive permission management system
- 🔄 Real-time service status monitoring
- 📝 Detailed audit logging
- ⏰ Scheduled downtime management
- 🔒 AES encryption for sensitive data

---

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js with Express.js
- **Databases**: 
  - MySQL (MariaDB) - Two databases: `auth_module` and `service_registry`
  - Redis - Session management, rate limiting, and caching
- **Message Queue**: Apache Kafka (for FCM device token registration)
- **ORM**: Sequelize
- **Process Manager**: PM2 (with ecosystem configuration)
- **Authentication**: JWT (jsonwebtoken) with refresh tokens
- **SSO**: Azure AD (Microsoft Entra ID) via ROPC flow

### System Components
```
┌─────────────────────────────────────────────────────────────┐
│                     Auth Module Service                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Controllers  │  │ Repositories │  │   Services   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Middleware  │  │   Validators │  │    Utils     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Database Layer (Sequelize)              │  │
│  │  ┌────────────────┐      ┌────────────────┐        │  │
│  │  │  auth_module   │      │service_registry│        │  │
│  │  │   (Primary)    │      │   (Secondary)  │        │  │
│  │  └────────────────┘      └────────────────┘        │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Redis     │  │    Kafka     │  │  Azure AD    │     │
│  │  (Sessions)  │  │   (Queue)    │  │    (SSO)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 Database Structure

### Primary Database: `auth_module`

#### Core User Management Tables
- **`users`** - Core user information
  - `id`, `email`, `password`, `first_name`, `last_name`
  - `is_active`, `has_password_changed`, `sso_login_enabled`
  - User activation status and authentication preferences

- **`user_roles`** - User-to-role mappings
- **`user_departments`** - User-to-department mappings
- **`user_customers`** - User-to-customer mappings
- **`user_factories`** - User-to-factory mappings
- **`user_systems`** - User-to-system access mappings
- **`user_special_functions`** - User-to-special-function mappings

#### Authorization Tables
- **`roles`** - Role definitions
  - Linked to systems
  - Can have permissions

- **`departments`** - Department definitions
  - Linked to systems
  - Used for permission scoping

- **`permissions`** - Permission matrix
  - `role_id`, `department_id`, `screen_id`, `access_type_id`
  - Supports role-only and role+department permissions
  - `department_id` can be `NULL` (applies to all users with the role)

- **`screens`** - Application screens/pages
  - `name`, `code`, `category`, `main_icon`, `secondary_icon`
  - Linked to systems

- **`permission_types`** - Access types (Read, Write, Delete, etc.)

#### Multi-Tenancy Tables
- **`customers`** - Customer/client organizations
- **`factories`** - Manufacturing facilities
- **`countries`** - Geographic locations for factories
- **`systems`** - Different applications/systems
  - `url`, `refresh_token_enabled`, `block_login_when_active_downtime`

#### Special Features
- **`special_functions`** - Additional user capabilities
- **`login_audit_logs`** - Authentication event tracking
  - `user_id`, `email`, `ip_address`, `event_type`, `details`, `created_at`

### Secondary Database: `service_registry`

#### Downtime Management
- **`downtime_logs`** - Scheduled maintenance tracking
  - `system_id`, `from_time`, `to_time`, `finished`, `archived`
  - Blocks login when `block_login_when_active_downtime` is enabled

#### Service Status
- **`services`** - External service definitions
- **`unauthorized_paths`** - Paths that don't require authentication

---

## 🔐 Authentication System

### 1. Dual Authentication Modes

#### Local Authentication (`signInLocal`)
Traditional username/password authentication with bcrypt password hashing.

**Flow:**
1. User provides `email` and `password`
2. System validates credentials against database
3. Password verified using `bcrypt.compare()`
4. JWT tokens generated on successful authentication

**Features:**
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Password change enforcement (`has_password_changed` flag)
- ✅ Failed login tracking with Redis
- ✅ Account lockout after max failed attempts
- ✅ Rate limiting by IP address

#### Azure AD SSO Authentication (`signInSSO`)
Integration with Microsoft Entra ID (Azure AD) using Resource Owner Password Credentials (ROPC) flow.

**Flow:**
1. User provides Microsoft credentials
2. System validates against Azure AD token endpoint
3. On success, user data fetched from local database
4. JWT tokens generated for application access

**Configuration Required:**
```javascript
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
```

**User SSO Preference:**
- Users have `sso_login_enabled` flag in database
- `signIn()` function routes to appropriate authentication method
- Seamless switching between local and SSO authentication

### 2. Token Management System

#### Access Tokens (Short-lived)
- **Duration**: 15 minutes
- **Purpose**: API authentication
- **Storage**: HTTP-only cookie + response body
- **Payload**: 
  ```javascript
  {
    userId, 
    email, 
    tokenId,        // Unique token identifier for revocation
    loginTime,      // Login timestamp
    clientIp,       // User's IP address
    type: 'access'  // Token type
  }
  ```

#### Refresh Tokens (Long-lived)
- **Duration**: 24 hours
- **Purpose**: Renewing access tokens
- **Storage**: HTTP-only cookie only (not in response body)
- **Payload**: 
  ```javascript
  {
    userId, 
    email, 
    tokenId,        // Unique token identifier
    type: 'refresh' // Token type
  }
  ```

#### System-Configurable Refresh Token

**Database Control:**
Each system in the `systems` table has `refresh_token_enabled` flag:
- `1` = Refresh tokens enabled (returns both access + refresh token)
- `0` = Traditional mode (single 12-hour token only)

**Benefits:**
- Legacy system compatibility
- Granular control per application
- Backward compatible migration path

**Implementation:**
```javascript
const refreshTokenEnabled = await checkRefreshTokenEnabled(system);

if (refreshTokenEnabled && refreshTokenEnabled.length > 0) {
  // Modern: Short-lived access token + refresh token
  const { accessToken, refreshToken, tokenId } = 
    await generateTokens(payload, jwtSecret);
  return { token: accessToken, refreshToken, ... };
} else {
  // Legacy: Single long-lived token
  const token = jwt.sign(payload, jwtSecret, { expiresIn: "12h" });
  return { token, ... };
}
```

#### Token Refresh Flow (`/auth/refresh`)
1. Client sends refresh token (from cookie or Authorization header)
2. Server verifies refresh token validity
3. Old token revoked in Redis
4. New access token + refresh token pair generated
5. Tokens sent back to client

#### Token Revocation (Logout)
- **Single Device**: `POST /auth/logout` - Revokes current token
- **All Devices**: `POST /auth/logout-all` - Revokes all user tokens
- **Admin Action**: `POST /auth/logout-all-users` - System-wide logout (admin only)

**Redis Token Store:**
```javascript
// Key pattern
`revoked_tokens:{userId}` -> Set of revoked token IDs

// Lockout tracking
`lockout:{userId}` -> {attempts, lockoutUntil}

// Rate limiting
`rate_limit:{ip}` -> {count, resetTime}
```

---

## 🛡️ Security Features

### 1. Security Utils (`authSecurityUtils.js`)

#### Rate Limiting
**IP-based Rate Limiting:**
- **Limit**: 10 login attempts per 15 minutes per IP
- **Storage**: Redis (`rate_limit:{ip}`)
- **Action**: Block further attempts, return 429 error

```javascript
await checkLoginRateLimit(clientIp);
// Throws error if limit exceeded
```

#### Account Lockout
**Failed Login Tracking:**
- **Limit**: 5 failed attempts
- **Duration**: Account locked (user deactivated in DB)
- **Storage**: Redis (`lockout:{userId}`)
- **Recovery**: Admin must reactivate account

```javascript
await recordFailedLogin(userId);
const lockout = await getUserLockout(userId);
if (lockout.attempts >= MAX_FAILED_ATTEMPTS) {
  await user.update({ is_active: 0 }, { where: { id: userId } });
}
```

#### Token Generation & Verification
```javascript
// Generate token pair with unique IDs
const { accessToken, refreshToken, tokenId } = 
  await generateTokens(payload, secret);

// Verify token
const decoded = await verifyToken(token, secret, 'access');

// Revoke tokens
await revokeToken(userId, tokenId);
await revokeAllUserTokens(userId);
```

### 2. JSON Security Utils (`jsonSecurityUtils.js`)

#### Safe JSON Parsing
Prevents JSON parsing attacks and limits data size:
```javascript
const data = safeJsonParse(jsonString, { maxLength: 100000 });
```

**Protections:**
- Maximum JSON string length validation
- Try-catch error handling
- Returns null on invalid JSON
- Prevents DoS via large payloads

#### Safe JSON Stringification
```javascript
const jsonString = safeJsonStringify(data);
```

**Features:**
- Handles circular references
- Error handling
- Consistent serialization

### 3. Redis Security Utils (`redisSecurityUtils.js`)

#### Key Sanitization
Prevents Redis command injection and ensures key validity:

```javascript
const safeKey = sanitizeRedisKey(userInput);
// Removes invalid characters, limits length
```

**Features:**
- Whitelist-based character filtering (`a-zA-Z0-9:_-.@`)
- Maximum key length: 250 characters
- Empty key detection
- Multiple underscore normalization

#### Safe Redis Key Builder
```javascript
const key = buildSafeRedisKey('prefix', userId, 'suffix');
// Returns: "prefix:userId:suffix" (sanitized)
```

### 4. AES Encryption (`aesEncryption.js`)

**Symmetric encryption for sensitive data:**
```javascript
// Encryption
const encrypted = encrypt(plainText);

// Decryption  
const decrypted = decrypt(encryptedText);
```

**Configuration:**
- Algorithm: `aes-256-cbc`
- Key: 32 bytes from `AES_ENCRYPTION_KEY` env variable
- IV: 16 bytes from `AES_ENCRYPTION_IV` env variable

**Use Cases:**
- Sensitive user data
- Confidential configuration values
- Secure data transmission

### 5. Middleware Protection

#### Authentication Middleware (`authentication.js`)
```javascript
// Verify JWT token from cookie or header
router.use(authMiddleware);
```

#### Secure Authentication Middleware (`secureAuthentication.js`)
```javascript
// Advanced verification with token revocation check
router.use(secureAuthMiddleware);
```

**Features:**
- Token validation
- Redis revocation check
- User existence verification
- Request context injection (`req.user`)

### 6. Audit Logging

**Login Events Tracked:**
- `login_success` - Successful authentication
- `login_failed` - Failed authentication attempt
- `wrong_password` - Incorrect password
- `user_not_found` - Non-existent user
- `rate_limit_exceeded` - Too many attempts
- `user_deactivated` - Account locked due to failed attempts
- `sso_login_success` - SSO authentication success
- `sso_login_failed` - SSO authentication failure

**Log Structure:**
```javascript
{
  user_id: 123,
  email: 'user@example.com',
  ip_address: '192.168.1.1',
  event_type: 'login_success',
  details: 'Additional context',
  created_at: '2025-11-14T10:30:00Z'
}
```

---

## 👥 Authorization & Permissions

### Permission System Architecture

The system uses a **Role + Department based permission model** with support for hierarchical permission inheritance.

### Permission Flow

```
User → Roles → Permissions ← Screens
  ↓            ↓
Departments    Access Types (Read, Write, Delete)
```

### How Permissions Work

#### 1. Role-Only Permissions
When `department_id` is `NULL`, the permission applies to **all users** with that role:

```sql
-- All users with "Admin" role can access "User Management" screen
INSERT INTO permissions (role_id, department_id, screen_id, access_type_id)
VALUES (1, NULL, 10, 2); -- Write access
```

#### 2. Role + Department Permissions
When `department_id` is specified, permission is **more restrictive**:

```sql
-- Only "Manager" role in "IT Department" can access "Server Config" screen
INSERT INTO permissions (role_id, department_id, screen_id, access_type_id)
VALUES (3, 5, 15, 1); -- Read access
```

### Permission Query Logic

**During Login:**
```javascript
// Get all permissions for user's roles and departments
const allPermissions = await Permissions.findAll({
  where: {
    role_id: { [Op.in]: userRoleIds },
    [Op.or]: [
      { department_id: null },                    // Role-only permissions
      { department_id: { [Op.in]: userDeptIds }}  // Role+Dept permissions
    ]
  },
  include: [Screen, PermissionType, System]
});
```

**Result:**
- User gets **union** of all matching permissions
- More specific permissions (role+dept) don't override general ones (role-only)
- Permissions are scoped to systems the user has access to

### Navigation Building

The system builds a **unique navigation menu** based on:
1. User's assigned roles
2. User's assigned departments
3. User's assigned systems
4. Permissions for role/department combinations

**Deduplication:**
```javascript
const uniqueNavigation = [
  ...new Map(
    allPermissions
      .filter(p => userSystemNames.has(p.Screen.System.name))
      .map(p => [`${p.Screen.name}-${p.Screen.code}-${p.System.name}`, p])
  ).values()
];
```

### Multi-Tenancy Support

#### Customers
- Organization/client level grouping
- Users can belong to multiple customers
- Used for data segregation

#### Factories
- Physical location tracking
- Linked to countries
- Users assigned to specific factories
- Used for regional access control

#### Countries
- Geographic grouping of factories
- Used for compliance and data residency

#### Systems
- Different applications within the ecosystem
- Each system has independent:
  - Roles
  - Departments  
  - Screens
  - Permissions
- Users can access multiple systems simultaneously

**Example User Access:**
```javascript
{
  user: { id: 123, email: 'john@company.com' },
  roles: [
    { id: 1, role: 'Admin', system: 'ERP' },
    { id: 5, role: 'Viewer', system: 'WMS' }
  ],
  departments: [
    { id: 2, department: 'IT', system: 'ERP' }
  ],
  customers: ['ACME Corp', 'TechStart Inc'],
  factories: [
    { id: 1, factory: 'Plant A', country: 'USA' },
    { id: 3, factory: 'Plant C', country: 'Germany' }
  ],
  systems: [
    { system: 'ERP', url: 'https://erp.company.com' },
    { system: 'WMS', url: 'https://wms.company.com' }
  ],
  navigation: [
    { screenName: 'Users', screenCode: 'users', system: 'ERP', accessType: 'Write' },
    { screenName: 'Dashboard', screenCode: 'dashboard', system: 'WMS', accessType: 'Read' }
  ]
}
```

### Access Control Check

**Runtime Authorization (`checkAccess`):**
```javascript
// Check if user has permission to access a specific path
const hasAccess = await checkAccess(userId, '/user-management');
```

Used by middleware to verify screen-level access in real-time.

---

## ⚙️ Configuration & Deployment

### Environment Files

The application uses **three environment files** for different deployment stages:

#### 1. `.env.development` (Local Development)
```env
NODE_ENV=development
PORT=3000

# Database - Local MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=localpassword
DB_NAME=auth_module

# Service Registry DB
SR_DB_HOST=localhost
SR_DB_NAME=service_registry

# Redis - Local
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka - Local
KAFKA_BROKER=localhost:9092

# JWT
JWT_SECRET_KEY=your-dev-secret-key-min-32-chars

# Azure AD (Optional for SSO)
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=

# AES Encryption
AES_ENCRYPTION_KEY=32-char-encryption-key-for-dev
AES_ENCRYPTION_IV=16-char-iv-dev

# CORS
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:4200
```

#### 2. `.env.test` (Staging/Testing)
```env
NODE_ENV=test
PORT=3001

# Database - Test Server
DB_HOST=172.33.0.105
DB_PORT=3306
DB_USER=test_user
DB_PASSWORD=test_password
DB_NAME=auth_module_test

# Redis - Test Server
REDIS_HOST=172.33.0.107
REDIS_PORT=6379

# Kafka - Test Cluster
KAFKA_BROKER=172.33.0.108:9092

# JWT (Different key for test)
JWT_SECRET_KEY=your-test-secret-key-min-32-chars

# Azure AD Test Environment
AZURE_AD_TENANT_ID=test-tenant-id
AZURE_AD_CLIENT_ID=test-client-id
AZURE_AD_CLIENT_SECRET=test-client-secret

# Cors - Test Frontend
ALLOWED_ORIGINS=https://test.company.com
```

#### 3. `.env.production` (Production)
```env
NODE_ENV=production
PORT=3002

# Database - Production Cluster
DB_HOST=172.33.0.110
DB_PORT=3306
DB_USER=prod_user
DB_PASSWORD=strong-production-password
DB_NAME=auth_module

# Redis - Production (Master)
REDIS_HOST=172.33.0.111
REDIS_PORT=6379
REDIS_PASSWORD=redis-prod-password

# Kafka - Production Cluster
KAFKA_BROKER=172.33.0.112:9092,172.33.0.113:9092

# JWT (Strong key for production)
JWT_SECRET_KEY=very-strong-production-secret-key-64-chars-min

# Azure AD Production
AZURE_AD_TENANT_ID=prod-tenant-id
AZURE_AD_CLIENT_ID=prod-client-id
AZURE_AD_CLIENT_SECRET=prod-client-secret

# AES Encryption (Unique for prod)
AES_ENCRYPTION_KEY=strong-32-char-prod-encryption-key
AES_ENCRYPTION_IV=strong-16-char-iv

# CORS - Production Domains
ALLOWED_ORIGINS=https://app.company.com,https://erp.company.com

# SSL/Security
SSL_ENABLED=true
COOKIE_SECURE=true
```

### Server Configuration (`server.js`)

#### Core Features

**1. CORS (Cross-Origin Resource Sharing)**
```javascript
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'original-origin']
}));
```

**2. Rate Limiting (Application-level)**
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // Max 100 requests per window
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
```

**3. Body Parsing & Security**
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet());  // Security headers
app.use(compression());  // Response compression
```

**4. Cookie Parser**
```javascript
app.use(cookieParser());  // Parse HTTP-only cookies for tokens
```

**5. Custom Headers**
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'Auth-Module');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
```

**6. Logging**
```javascript
app.use(morgan('combined', { stream: logger.stream }));
```

### PM2 Process Management

#### Ecosystem Files

**1. `ecosystem.dev.config.js` (Development)**
```javascript
module.exports = {
  apps: [{
    name: 'auth-module-dev',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: true,
    watch_delay: 1000,
    ignore_watch: ['node_modules', 'logs', '.git'],
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_file: '.env.development',
    error_file: './logs/dev-error.log',
    out_file: './logs/dev-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**2. `ecosystem.test.config.js` (Testing/Staging)**
```javascript
module.exports = {
  apps: [{
    name: 'auth-module-test',
    script: './server.js',
    instances: 2,  // Load balancing
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'test',
      PORT: 3001
    },
    env_file: '.env.test',
    error_file: './logs/test-error.log',
    out_file: './logs/test-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    max_restarts: 5
  }]
};
```

**3. `ecosystem.prod.config.js` (Production)**
```javascript
module.exports = {
  apps: [{
    name: 'auth-module-prod',
    script: './server.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    env_file: '.env.production',
    error_file: './logs/prod-error.log',
    out_file: './logs/prod-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    max_restarts: 3,
    restart_delay: 4000,
    
    // Advanced features
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Monitoring
    instance_var: 'INSTANCE_ID',
    
    // Graceful restart
    wait_ready: true
  }]
};
```

#### PM2 Commands

```bash
# Development
pm2 start ecosystem.dev.config.js
pm2 logs auth-module-dev

# Testing
pm2 start ecosystem.test.config.js
pm2 logs auth-module-test

# Production
pm2 start ecosystem.prod.config.js
pm2 logs auth-module-prod --lines 100

# Monitoring
pm2 monit

# Graceful Reload (Zero-downtime)
pm2 reload ecosystem.prod.config.js

# Stop
pm2 stop auth-module-prod

# Delete
pm2 delete auth-module-prod

# Save process list
pm2 save

# Startup script (auto-start on reboot)
pm2 startup
pm2 save
```

### Deployment Best Practices

**Development:**
```bash
npm install
cp .env.example .env.development
# Configure .env.development
pm2 start ecosystem.dev.config.js
```

**Testing:**
```bash
npm install --production
cp .env.example .env.test
# Configure .env.test with test server credentials
pm2 start ecosystem.test.config.js
```

**Production:**
```bash
# Build (if needed)
npm install --production

# Copy production env
cp .env.example .env.production
# Configure with production credentials

# Start with PM2
pm2 start ecosystem.prod.config.js

# Setup auto-start
pm2 startup systemd
pm2 save

# Monitor
pm2 monit
```

---

## 🔧 Downtime Management

### System Maintenance Control

The application supports **scheduled downtime** to block logins during maintenance periods.

#### Configuration

**System-level Control (`systems` table):**
```javascript
{
  url: 'https://erp.company.com',
  block_login_when_active_downtime: 1  // 1 = Block, 0 = Allow
}
```

**Downtime Record (`downtime_logs`):**
```javascript
{
  system_id: 5,
  from_time: '2025-11-14 02:00:00',
  to_time: '2025-11-14 06:00:00',
  finished: 0,     // 0 = Active, 1 = Completed
  archived: 0      // 0 = Active, 1 = Archived
}
```

#### How It Works

**During Login:**
```javascript
const downtimeInfo = await getActiveDowntimeForSystem(systemUrl);

if (downtimeInfo && downtimeInfo.length > 0) {
  throw new Error(
    `System temporarily unavailable: Scheduled maintenance in progress until ${downtimeInfo[0].to_time}. Login access will be restored once maintenance is complete.`
  );
}
```

**User Experience:**
- **Status Code**: 503 (Service Unavailable)
- **Message**: Includes estimated completion time
- **Effect**: Prevents all logins to affected system
- **Scope**: System-specific (other systems remain accessible)

---

## 📚 API Documentation

### Authentication Endpoints

#### `POST /auth/signin`
Local or SSO authentication (automatic routing).

**Request:**
```json
{
  "email": "user@company.com",
  "password": "password123",
  "deviceToken": "fcm-device-token" // Optional
}
```

**Headers:**
```
original-origin: https://erp.company.com
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..." // If enabled
  "tokenId": "uuid-v4",
  "expiresIn": 900,
  "user": {
    "id": 123,
    "email": "user@company.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "roles": [...],
  "departments": [...],
  "customers": [...],
  "factories": [...],
  "systems": [...],
  "navigation": [...]
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Wrong password!",
  "error": "..." // Only in development
}
```

#### `POST /auth/refresh`
Refresh access token using refresh token.

**Headers:**
```
Cookie: refreshToken=eyJhbGciOiJIUzI1NiIs...
// OR
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new-access-token",
    "tokenId": "new-token-id",
    "expiresIn": 900
  }
}
```

#### `POST /auth/logout`
Logout from current device.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### `POST /auth/logout-all`
Logout from all devices.

**Request:**
```json
{
  "userId": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out from 3 devices successfully"
}
```

#### `POST /auth/logout-all-users` (Admin Only)
System-wide logout (emergency use).

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out all users (revoked 150 tokens)",
  "usersAffected": 50,
  "timestamp": "2025-11-14T10:30:00.000Z"
}
```

### User Management Endpoints

#### `GET /users`
Get all users (with filters).

#### `GET /users/:id`
Get specific user details.

#### `POST /users`
Create new user.

#### `PUT /users/:id`
Update user information.

#### `DELETE /users/:id`
Soft delete (deactivate) user.

### Service Status Endpoints

#### `GET /service-status/redis`
Check Redis connectivity and statistics.

**Response:**
```json
{
  "status": "OK",
  "message": "Redis is connected and responsive",
  "details": {
    "responseTime": "15ms",
    "host": "172.33.0.107",
    "port": 6379,
    "memory": "2.5M",
    "connectedClients": 5,
    "uptime": "7d 3h 45m 12s"
  }
}
```

#### `GET /service-status/kafka`
Check Kafka connectivity.

**Response:**
```json
{
  "status": "OK",
  "message": "Kafka is connected and responsive",
  "details": {
    "responseTime": "25ms",
    "broker": "172.33.0.107:9092",
    "topics": ["user-events", "notifications"],
    "brokerCount": 3,
    "controllerId": 1
  }
}
```

#### `GET /service-status/cache-keys`
List all Redis cache keys (sorted alphabetically).

**Response:**
```json
{
  "status": "OK",
  "message": "Retrieved 42 cache keys",
  "responseTime": "125ms",
  "keys": [
    {
      "key": "getUserByEmail:john@company.com",
      "ttl": "1800s",
      "type": "string",
      "size": 1024,
      "valuePreview": "{\"id\":123,\"email\":\"john@...\"}..."
    }
  ]
}
```

#### `DELETE /service-status/cache-keys/:key`
Delete specific cache key.

---

## 🚀 Development Guide

### Getting Started

**1. Prerequisites:**
```bash
Node.js >= 16.x
MySQL/MariaDB >= 10.x
Redis >= 6.x
Kafka >= 2.x (optional)
PM2 (npm install -g pm2)
```

**2. Installation:**
```bash
# Clone repository
git clone <repository-url>
cd auth-module

# Install dependencies
npm install

# Setup environment
cp .env.example .env.development
# Edit .env.development with your local configuration

# Run database migrations (if available)
npm run migrate

# Seed database (if available)
npm run seed
```

**3. Running:**
```bash
# Development (with hot-reload)
npm run dev
# OR
pm2 start ecosystem.dev.config.js

# Production
npm start
# OR
pm2 start ecosystem.prod.config.js
```

### Project Structure

```
auth-module/
├── app/
│   ├── controllers/           # Request handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   └── serviceStatus.controller.js
│   ├── repositories/          # Data access layer
│   │   ├── auth.repository.js
│   │   └── user.repository.js
│   ├── services/             # Business logic
│   ├── models/               # Sequelize models
│   │   ├── user.js
│   │   ├── role.js
│   │   ├── permission.js
│   │   └── index.js
│   ├── middleware/           # Express middleware
│   │   ├── authentication.js
│   │   └── secureAuthentication.js
│   ├── routes/               # API routes
│   │   ├── index.js
│   │   ├── auth.route.js
│   │   └── user.route.js
│   ├── validators/           # Input validation
│   ├── utils/                # Utility functions
│   │   ├── authSecurityUtils.js
│   │   ├── jsonSecurityUtils.js
│   │   ├── redisSecurityUtils.js
│   │   ├── aesEncryption.js
│   │   └── logger.js
│   ├── database/             # Database connections
│   │   ├── index.js          # Primary DB (auth_module)
│   │   ├── indexSR.js        # Service Registry DB
│   │   └── redisClient.js
│   ├── kafka/                # Kafka integration
│   │   ├── kafkaClient.js
│   │   ├── producer.js
│   │   └── controller.js
│   └── constants/            # Application constants
├── logs/                     # Application logs
├── .env.development          # Dev environment variables
├── .env.test                # Test environment variables
├── .env.production          # Production environment variables
├── server.js                # Application entry point
├── ecosystem.dev.config.js  # PM2 dev configuration
├── ecosystem.test.config.js # PM2 test configuration
├── ecosystem.prod.config.js # PM2 production configuration
├── package.json
├── Dockerfile               # Docker container definition
└── README.md               # This file
```

### Coding Standards

**Controller Pattern:**
```javascript
const controllerFunction = async (req, res, next) => {
  try {
    // 1. Validate request
    // 2. Call repository/service
    // 3. Return response
    res.status(200).json({ success: true, data });
  } catch (err) {
    // 4. Handle errors consistently
    next(err); // or res.status(500).json({ success: false, message })
  }
};
```

**Repository Pattern:**
```javascript
const repositoryFunction = async (params) => {
  try {
    // 1. Database operations
    // 2. Business logic
    // 3. Return data
    return data;
  } catch (err) {
    // 4. Throw descriptive errors
    throw new Error(`Operation failed: ${err.message}`);
  }
};
```

**Error Handling:**
```javascript
// Repository: Throw clean Error objects (no status codes)
throw new Error("User not found");

// Controller: Determine status codes based on error message
let statusCode = 500;
if (err.message.includes('not found')) statusCode = 404;
if (err.message.includes('Invalid')) statusCode = 400;
res.status(statusCode).json({ success: false, message: err.message });
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

### Common Tasks

**Add New Permission:**
```sql
-- 1. Create screen
INSERT INTO screens (name, code, category, system_id)
VALUES ('New Feature', 'new-feature', 'Management', 1);

-- 2. Create permission
INSERT INTO permissions (role_id, department_id, screen_id, access_type_id)
VALUES (1, NULL, (SELECT id FROM screens WHERE code = 'new-feature'), 2);
```

**Add New User:**
```javascript
// Password will be hashed automatically
const newUser = await user.create({
  email: 'newuser@company.com',
  password: 'temporaryPassword',
  first_name: 'John',
  last_name: 'Doe',
  is_active: 1,
  has_password_changed: 0,  // Force password change on first login
  sso_login_enabled: 0
});
```

**Clear Redis Cache:**
```bash
# Via API
curl -X DELETE http://localhost:3000/service-status/cache-keys/specific-key

# Via Redis CLI
redis-cli FLUSHDB
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: "JWT malformed" error**
- **Cause**: Invalid or expired token
- **Solution**: Clear cookies, re-login

**Issue: "ECONNREFUSED" Redis error**
- **Cause**: Redis not running or wrong host/port
- **Solution**: Check Redis service, verify `.env` configuration

**Issue: Rate limit errors in development**
- **Cause**: Too many login attempts
- **Solution**: Clear Redis rate limit keys or increase limit for dev

**Issue: Permission denied after role change**
- **Cause**: Old token with cached permissions
- **Solution**: Logout and re-login to get fresh permissions

**Issue: SSO authentication fails**
- **Cause**: Invalid Azure AD credentials or config
- **Solution**: Verify `AZURE_AD_*` environment variables

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check PM2 logs
pm2 logs auth-module-prod --lines 200

# Monitor Redis operations
redis-cli MONITOR
```

---

## 📞 Support & Contribution

### Getting Help
- Check logs in `./logs/` directory
- Review API documentation above
- Check Redis cache status via `/service-status/cache-keys`

### Contributing Guidelines
1. Create feature branch from `develop`
2. Follow existing code patterns
3. Add tests for new features
4. Update this README if needed
5. Submit pull request with clear description

---

## 📄 License

[Your License Here]

---

## 🔐 Security Notes

**DO NOT commit:**
- `.env.*` files to version control
- Private keys or certificates
- Production credentials
- JWT secrets

**Use `.gitignore`:**
```gitignore
.env.*
logs/
node_modules/
*.pem
*.key
```

---

**Last Updated**: November 14, 2025  
**Version**: 1.0.0  
**Maintainer**: [Your Name/Team]
