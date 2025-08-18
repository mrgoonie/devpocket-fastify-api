-- DevPocket Database Initialization Script
-- This script ensures the database is properly set up for development

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC
SET timezone = 'UTC';