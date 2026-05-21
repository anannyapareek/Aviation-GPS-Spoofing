# Aviation GPS Spoofing SIEM

This project is a multi-service Security Information and Event Management (SIEM) system designed to detect and log GPS spoofing anomalies in aviation data.

## System Architecture

The environment consists of four main components:
1. **Database (MySQL)**: Persistent storage for raw telemetry, forensic logs, and user accounts.
2. **Analytics Engine (Python/FastAPI)**: Ingests OpenSky data, detects anomalies (ML & physics-based), and generates SHA-256 digital seals. Runs on port `8000`.
3. **Auth Bridge (Java/Spring Boot)**: Provides Role-Based Access Control (RBAC) and exposes the forensic data securely. Runs on port `8080`.
4. **Sandbox UI (React/Vite)**: A frontend for manual data ingestion and simulation. Runs on port `5173`.

---

## Step-by-Step Run Instructions

Follow these steps in order to launch the full environment.

### Step 1: Database Setup (MySQL)
Ensure you have a MySQL server running locally on the default port `3306`.
1. Open your preferred MySQL client (e.g., MySQL Workbench, DBeaver, or CLI).
2. Execute the `database.sql` script located in the root of this repository.
   - This will create the `aviation_siem` database and all required tables (`Raw_Ingest`, `users`, `forensic_logs`).

### Step 2: Python Analytics Engine
This service handles data ingestion and anomaly detection.
1. Open a new terminal in the root directory of the project.
2. Ensure you have Python 3 installed.
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the root directory based on `.env.example` and update it with your MySQL credentials:
   ```env
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_DB=aviation_siem
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn main:app --port 8000 --reload
   ```
   *The Python backend is now running on `http://localhost:8000`.*

### Step 3: Java Auth Service
This service acts as a secure bridge for forensic data.
1. Open a new terminal and navigate to the `auth-service` directory:
   ```bash
   cd auth-service
   ```
2. Verify that `src/main/resources/application.properties` has the correct MySQL credentials.
3. Build and run the Spring Boot application using Maven:
   ```bash
   mvn clean install
   mvn spring-boot:run
   ```
   *The Java Auth service is now running on `http://localhost:8080`.*

### Step 4: React Sandbox UI
This is the frontend interface for manual data injection.
1. Open a new terminal and navigate to the `frontend/lovable website frontend` directory:
   ```bash
   cd "frontend/lovable website frontend"
   ```
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The React UI is now running on `http://localhost:5173`.*

---

## Testing the System
1. Open your browser and go to `http://localhost:5173`.
2. Use the **Manual Ingestion Sandbox** to inject simulated telemetry (e.g., a packet that will trigger a spoofing anomaly).
3. Check the Python terminal to see the detection and generation of the digital seal.
4. (Optional) Use a tool like Postman to authenticate with the Java Auth service and retrieve the sealed forensic data from `http://localhost:8080/api/forensic/data`.
