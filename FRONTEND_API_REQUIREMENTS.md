# Frontend API Requirements

This document defines the contract the current frontend expects from the backend without coupling the UI to a specific implementation.

## 1. Authentication

### Login
- Endpoint: `POST /api/v1/auth/login`
- Request body:
  ```json
  {
    "password": "string"
  }
  ```
- Success response:
  ```json
  {
    "authenticated": true,
    "user": {
      "name": "string"
    }
  }
  ```
- Error response:
  ```json
  {
    "error": "invalid_credentials",
    "message": "Invalid password."
  }
  ```

### Session
- Endpoint: `GET /api/v1/auth/session`
- Success response:
  ```json
  {
    "authenticated": true,
    "user": {
      "name": "string"
    }
  }
  ```

### Logout
- Endpoint: `POST /api/v1/auth/logout`
- Success response: `204 No Content`

## 2. Schools

### List schools
- Endpoint: `GET /api/v1/schools`
- Success response:
  ```json
  {
    "items": [
      {
        "id": "school-1",
        "name": "Texas Tech University Health Sciences Center",
        "location": "Lubbock, TX",
        "programCount": 4,
        "peopleCount": 132,
        "lastUpdated": "2026-09-10"
      }
    ]
  }
  ```

### Get school
- Endpoint: `GET /api/v1/schools/:schoolId`
- Success response: a single school object matching the list schema.

## 3. Programs

### List programs for a school
- Endpoint: `GET /api/v1/schools/:schoolId/programs`
- Success response:
  ```json
  {
    "items": [
      {
        "id": "program-101",
        "schoolId": "school-1",
        "name": "Internal Medicine Residency",
        "type": "Residency",
        "residentCount": 52,
        "fellowCount": 8,
        "peopleCount": 60,
        "lastUpdated": "2026-09-10",
        "startUrl": "https://example.com/program",
        "directoryUrl": "https://example.com/directory"
      }
    ]
  }
  ```

### Get program
- Endpoint: `GET /api/v1/programs/:programId`
- Success response: a single program object matching the list schema.

## 4. People

### List people for a program
- Endpoint: `GET /api/v1/programs/:programId/people`
- Success response:
  ```json
  {
    "items": [
      {
        "id": "person-1001",
        "programId": "program-101",
        "schoolId": "school-1",
        "name": "Daniel Roberts",
        "trainingType": "Resident",
        "year": "PGY-2",
        "specialty": "Internal Medicine",
        "email": "daniel.roberts@example.edu",
        "phone": "(806) 555-0142",
        "status": "new",
        "lastVerified": "2026-09-08",
        "source": "Official physician directory",
        "sourceAvailable": true,
        "sourceUrl": "https://example.edu/person",
        "pageTitle": "Daniel Roberts | Internal Medicine Resident",
        "extractedText": "Resident physician in Internal Medicine.",
        "confidence": 0.96,
        "department": "Internal Medicine",
        "track": "General Internal Medicine",
        "role": "Resident Physician",
        "graduationYear": "2027",
        "profileUrl": "https://example.edu/profile",
        "versionHistory": [
          {
            "id": "v-1",
            "date": "2026-09-10",
            "field": "Email changed",
            "oldValue": "daniel.r@example.edu",
            "newValue": "daniel.roberts@example.edu",
            "sourceUrl": "https://example.edu/person",
            "screenshotAvailable": true
          }
        ]
      }
    ]
  }
  ```

### Get person
- Endpoint: `GET /api/v1/people/:personId`
- Success response: a single person object matching the list schema.

### Get person source metadata
- Endpoint: `GET /api/v1/people/:personId/source`
- Success response:
  ```json
  {
    "sourceUrl": "https://example.edu/person",
    "pageTitle": "Daniel Roberts | Internal Medicine Resident",
    "capturedAt": "2026-09-08",
    "extractionMethod": "Structured directory extraction",
    "confidence": 0.96,
    "screenshotAvailable": true,
    "screenshotUrl": "https://example.edu/screenshots/person-1001.png",
    "extractedText": "Resident physician in Internal Medicine."
  }
  ```

## 5. Runs / Crawls

### Start run
- Endpoint: `POST /api/v1/runs`
- Request body:
  ```json
  {
    "programId": "program-101",
    "runDirectorySearch": true,
    "runNewCrawl": true,
    "directoryUrl": "https://example.edu/directory",
    "startUrl": "https://example.edu/program",
    "peopleGoal": 45,
    "noFixedGoal": false
  }
  ```
- Success response:
  ```json
  {
    "id": "run-123",
    "programId": "program-101",
    "schoolId": "school-1",
    "status": "running",
    "stage": "discovering",
    "startedAt": "2026-09-11T09:30:00Z",
    "progress": 8,
    "counts": {
      "peopleFound": 0,
      "peopleEnriched": 0,
      "emailsFound": 0,
      "newCount": 0,
      "changedCount": 0,
      "missingCount": 0,
      "failedCount": 0
    },
    "programName": "Internal Medicine Residency",
    "schoolName": "Texas Tech University Health Sciences Center",
    "elapsedSeconds": 0,
    "runType": "New Crawl + Directory Search",
    "programUrl": "https://example.edu/program",
    "directoryUrl": "https://example.edu/directory",
    "peopleGoal": 45,
    "noFixedGoal": false
  }
  ```

### Get run
- Endpoint: `GET /api/v1/runs/:runId`
- Success response: same shape as start run response.

### Cancel run
- Endpoint: `POST /api/v1/runs/:runId/cancel`
- Success response: `204 No Content`

### Run stream / progress events
- Endpoint: `GET /api/v1/runs/:runId/stream` or SSE-compatible event stream
- Event payload:
  ```json
  {
    "type": "progress",
    "run": {
      "id": "run-123",
      "status": "running",
      "stage": "directory",
      "progress": 74,
      "counts": {
        "peopleFound": 34,
        "peopleEnriched": 21,
        "emailsFound": 19,
        "newCount": 9,
        "changedCount": 4,
        "missingCount": 6,
        "failedCount": 0
      }
    }
  }
  ```

## 6. Shared response conventions

- All successful responses should use JSON objects unless the endpoint explicitly returns `204 No Content`.
- `status` fields should use one of:
  - `queued`
  - `running`
  - `completed`
  - `failed`
  - `cancelled`
- `stage` fields should use one of:
  - `discovering`
  - `directory`
  - `finalizing`
  - `complete`
- `confidence` should be a decimal between 0 and 1.
- Missing values should use `null` or omit the field consistently when the field is optional.

## 7. Frontend integration expectations

- UI components should interact fully through the adapter modules in `src/api/*`.
- Mock adapters should remain the default for local development while a real backend is added.
- Any backend response should be normalized before entering the screen-level components.
- Any future real API should preserve the same domain contracts used by the existing mock data to minimize frontend churn.
