
CREATE DATABASE aviation_siem;
USE aviation_siem;

CREATE TABLE Raw_Ingest (
    id INT AUTO_INCREMENT PRIMARY KEY,
    icao24 VARCHAR(20),
    callsign VARCHAR(20),
    payload JSON,           -- Stores the full AviationPacket
    sha256_hash VARCHAR(64), -- Your forensic signature
    source VARCHAR(20),      -- 'OpenSky' or 'Manual_Simulation'
    inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The table for user accounts (RBAC)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    role ENUM('Observer', 'Analyst', 'Admin') DEFAULT 'Observer'
);

SELECT icao24, callsign, source, inserted_at 
FROM Raw_Ingest;

SELECT 
    source, 
    callsign, 
    sha256_hash, 
    payload->>'$.geo_alt' as altitude 
FROM Raw_Ingest 
WHERE source != 'OpenSky'
ORDER BY inserted_at DESC;

SELECT * FROM Raw_Ingest 
WHERE source = 'Manual_Simulation' 
ORDER BY inserted_at DESC;

SELECT 
    callsign, 
    sha256_hash, 
    payload->>'$.baro_alt' AS barometric_altitude,
    payload->>'$.geo_alt' AS gps_altitude,
    inserted_at
FROM Raw_Ingest 
WHERE source = 'Manual_Simulation'
ORDER BY inserted_at DESC;

SELECT icao24, callsign, source
FROM Raw_Ingest 
WHERE ABS(CAST(payload->>'$.geo_alt' AS SIGNED) - CAST(payload->>'$.baro_alt' AS SIGNED)) > 5000;

-- Table for forensic investigation logs
CREATE TABLE forensic_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    icao24 VARCHAR(20),
    latitude FLOAT,
    longitude FLOAT,
    timestamp BIGINT,
    mitre_technique VARCHAR(50),
    description TEXT,
    inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Execute ALTER to add forensic_hash as requested
ALTER TABLE forensic_logs ADD COLUMN forensic_hash VARCHAR(64);

SELECT id, forensic_hash FROM forensic_logs;

SELECT icao24, forensic_hash FROM forensic_logs WHERE forensic_hash IS NOT NULL;
SELECT * FROM forensic_logs;
DESCRIBE aviation_siem.forensic_logs;
SELECT COUNT(*) FROM aviation_siem.forensic_logs; 
SELECT COUNT(*) FROM raw_ingest;
SELECT * FROM users WHERE username = 'viewer_user';
SELECT * FROM roles;
INSERT INTO user_roles (user_id, role_id) VALUES (5, 1);

UPDATE user_roles 
SET role_id = 2 
WHERE user_id = 5;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

USE aviation_siem;

-- 1. Temporarily bypass keys and clear the data states clean
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE user_roles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. FIX THE SCHEMA MISM_ATCH: Rewrite the ENUM definition to use uppercase strings
-- This explicitly redefines what values the database will allow to be stored
ALTER TABLE users 
    MODIFY COLUMN role ENUM('ROLE_OBSERVER', 'ROLE_ANALYST', 'ROLE_ADMIN') DEFAULT 'ROLE_OBSERVER';

-- 3. Run your multirole node inserts (These will now execute with clean green checkmarks!)
INSERT INTO users (id, username, password, role) 
VALUES (1, 'admin_operator', '$2a$10$ll10AvnvinLJ4XaP5blZmOx9o7NumQkgz7wjweYCRSBA3ApORQlnK', 'ROLE_ADMIN');
INSERT INTO user_roles (user_id, role_id) VALUES (1, 3);

INSERT INTO users (id, username, password, role) 
VALUES (5, 'analyst_operator', '$2a$10$n4qfvFgWKc5Qrolirmf61ewv3LaIYwlrpRJxusTNuWyzQCEJWg3gW', 'ROLE_ANALYST');
INSERT INTO user_roles (user_id, role_id) VALUES (5, 2);

INSERT INTO users (id, username, password, role) 
VALUES (10, 'observer_operator', '$2a$10$sbrDqfjO7l.7RRpAXuqcTeCgPiJZNa4xgszbGPjhkMtt/BGl7HSSO', 'ROLE_OBSERVER');
INSERT INTO user_roles (user_id, role_id) VALUES (10, 1);




