# AIrbnb-style Cloud Expo Runner

A lightweight web app that provides:
- Auth screen (GitHub OAuth + demo login)
- Browser terminal log stream
- GitHub repo bootstrap
- Cloud command runner for `npx expo start --tunnel --clear`
- QR code rendering for Expo URL so you can open in Expo Go on Android

## Run

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000`.

## How it works

1. Login via GitHub or demo login.
2. Enter your GitHub repo + branch.
3. Click **Start Expo**.
4. Server clones/fetches repo, installs dependencies, and runs Expo tunnel.
5. Terminal output streams live and QR is displayed when Expo URL appears.

## Deploy in cloud

Deploy this Node app on any VM/container service (Railway, Render, Fly.io, EC2, etc.) with:
- Node 18+
- `git` installed
- outbound internet access for npm + Expo tunnel

Then access the app from phone browser and scan QR in Expo Go.
