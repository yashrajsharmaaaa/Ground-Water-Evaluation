# Google Maps Setup Guide

## Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

## Step 2: Configure API Key

### Option 1: Using app.json (Recommended for development)
Replace `YOUR_GOOGLE_MAPS_API_KEY` in `app.json` with your actual API key:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSy..."
    }
  }
},
"ios": {
  "config": {
    "googleMapsApiKey": "AIzaSy..."
  }
}
```

### Option 2: Using environment variables (Recommended for production)
1. Create `.env` file in frontend folder:
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

2. Update app.json to use env variable:
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}"
    }
  }
}
```

## Step 3: Rebuild the app

After adding the API key, rebuild your app:

```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios

# For Expo Go (development)
npx expo start --clear
```

## Note for Expo Go Users

If you're using Expo Go app for testing, the map will work but may show a "For development purposes only" watermark. This is normal and will be removed in production builds.

## Troubleshooting

### Map shows blank/gray screen
- Check if API key is correctly configured
- Ensure Maps SDK is enabled in Google Cloud Console
- Check if billing is enabled (Google requires it even for free tier)

### "API key not valid" error
- Verify the API key is correct
- Check if the API key has restrictions that block your app
- Ensure Maps SDK for Android/iOS is enabled

### Map works on one platform but not the other
- Check if you've configured the API key for both iOS and Android
- Verify both Maps SDKs are enabled in Google Cloud Console
