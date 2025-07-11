# Timer Tracker

This project contains a simple earnings tracker that runs as an Expo app.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the mobile app with Expo:
   ```bash
   npm start
   ```
3. To run the backend server for data storage:
   ```bash
   npm run start-server
   ```

The app requires an Apple ID for authentication. After signing in you can start
and stop the timer, view your history, and edit or delete entries. Earnings are
stored per user and warnings appear when yearly totals exceed 103万, 130万, or
150万円.
