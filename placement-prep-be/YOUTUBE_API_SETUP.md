# YouTube API Setup Guide

## Quick Setup Instructions

To enable YouTube tutorials fetching in your application, follow these steps:

### 1. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Enable the **YouTube Data API v3**:
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create credentials:
   - Go to "Credentials" tab
   - Click "Create Credentials" → "API Key"
   - Copy your API key

### 2. Add to Environment Variables

Add your YouTube API key to your `.env` file in the backend:

```env
YOUTUBE_API_KEY=your_api_key_here
```

### 3. Restart Your Backend Server

The application will now:
- Fetch real YouTube tutorials when available
- Fall back to curated default tutorials if API is not configured or rate limited

## Default Tutorials (No API Needed)

The application includes fallback tutorials for these subjects:
- **DSA** - Data Structures and Algorithms
- **DBMS** - Database Management Systems
- **OS** - Operating Systems
- **OOPS** - Object-Oriented Programming
- **JavaScript** - JavaScript Programming

## How It Works

1. When a user visits the `/personalizedreport` page, the chatbot loads
2. The chatbot fetches learning resources from `/v1/report/learning-resources`
3. For each subject with < 50% accuracy:
   - Fetches top 5 YouTube tutorials
   - Retrieves official documentation links
4. Resources are displayed in a collapsible section in the chatbot
5. Users can click on YouTube videos to watch or documentation links to learn

## What Gets Displayed

For each weak subject, users see:
- **Subject name** with current accuracy score
- **YouTube Tutorials** with:
  - Thumbnail preview
  - Video title
  - Channel name
  - Duration
  - Clickable link to watch on YouTube
- **Official Documentation** with:
  - Resource name
  - Description
  - Direct link to documentation
  - Type indicator (Official ✅ or Community 📚)

## Supported Subjects for Documentation

- Java
- Python
- JavaScript
- React
- TypeScript
- DSA
- DBMS
- OS
- OOPS

## API Endpoints

### Get Learning Resources
```
GET /v1/report/learning-resources
Headers: { token: your_token }

Response:
{
  "weakSubjects": [
    {
      "subject": "dsa",
      "accuracy": 45,
      "correctCount": 9,
      "totalCount": 20
    }
  ],
  "resources": [
    {
      "subject": "dsa",
      "accuracy": 45,
      "tutorials": [...],
      "documentation": [...]
    }
  ]
}
```

### Get Resources for Specific Subject
```
GET /v1/report/resources/:subject
Headers: { token: your_token }

Response:
{
  "subject": "dsa",
  "tutorials": [...],
  "documentation": [...]
}
```

## Features Implemented

✅ YouTube API integration with fallback to curated tutorials
✅ Official documentation links for major subjects
✅ Automatic detection of weak areas (< 50% accuracy)
✅ Embedded YouTube player previews in chatbot
✅ Direct links to documentation
✅ Mobile-responsive design
✅ Auto-load on report page
✅ Collapsible resource section for better UX

## Troubleshooting

### No Resources Showing Up
- Check if user has > 0 attempts in any subject
- Verify subject names match the supported list
- Check browser console for errors

### YouTube Videos Not Loading
- Ensure `YOUTUBE_API_KEY` is set in `.env`
- Check if API quota is exceeded
- Videos should fall back to default tutorials

### Documentation Links Not Working
- Verify internet connection
- Check if documentation URLs are still active
- Report broken links to update the service

## Notes

- API calls are cached in the frontend to avoid redundant requests
- YouTube API has a daily quota limit (typically 10,000 units/day)
- Each search query uses ~100 API units
- Default tutorials are used if API fails or quota is exceeded
- No cost incurred if using default tutorials only
