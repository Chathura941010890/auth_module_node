const dotenv = require('dotenv');
const path = require('path');

/**
 * Load environment variables based on NODE_ENV
 * Usage: 
 * - npm start (uses .env.dev)
 * - npm run test (uses .env.test) 
 * - npm run prod (uses .env.prod)
 */
function loadEnvironment() {
    const environment = process.env.NODE_ENV || 'development';
    
    let envFile;
    switch (environment) {
        case 'development':
            envFile = '.env.dev';
            break;
        case 'test':
            envFile = '.env.test';
            break;
        case 'production':
            envFile = '.env.prod';
            break;
        default:
            envFile = '.env'; // fallback to default .env
    }
    
    const envPath = path.resolve(process.cwd(), envFile);
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
        console.warn(`Warning: Could not load ${envFile}, falling back to .env`);
        dotenv.config(); // fallback to default .env
    } else {
        console.log(`Environment loaded from: ${envFile}`);
    }
    
    return result;
}

module.exports = { loadEnvironment };