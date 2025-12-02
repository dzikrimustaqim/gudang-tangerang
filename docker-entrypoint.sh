#!/bin/sh
set -e

echo "Waiting for database to be ready..."

# Wait for database to be available
until node -e "
const mysql = require('mysql2/promise');
(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'gudang_db',
      user: process.env.DB_USER || 'gudang_user',
      password: process.env.DB_PASSWORD || 'gudang_password'
    });
    await connection.end();
    console.log('Database is ready!');
    process.exit(0);
  } catch (error) {
    console.error('Database not ready:', error.message);
    process.exit(1);
  }
})();
" 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Copy dist files to shared volume for nginx
if [ -d "/app/dist" ] && [ -d "/web-dist" ]; then
  echo "Copying frontend files to web volume..."
  cp -r /app/dist/* /web-dist/
  echo "Frontend files copied successfully!"
fi

echo "Starting application..."

# Execute the main command
exec "$@"
