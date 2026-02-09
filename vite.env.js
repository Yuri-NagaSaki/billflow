// This file helps with environment variables in Vite
// It's loaded by vite.config.ts

const loadEnv = () => {
  const env = {};
  
  // Try to load from .env.local (highest priority)
  try {
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    
    // Load environment variables from .env files
    ['', '.local', '.development', '.production'].forEach(suffix => {
      const envPath = path.resolve(process.cwd(), `.env${suffix}`);
      if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        Object.assign(env, envConfig);
        console.log(`Loaded environment variables from .env${suffix}`);
      }
    });
  } catch (err) {
    console.error('Error loading environment variables:', err);
  }
  
  return env;
};

module.exports = { loadEnv };