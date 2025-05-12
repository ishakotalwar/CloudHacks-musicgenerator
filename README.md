# CloudHacks Music Moodboard

A React + AWS-powered site that recommends songs based on your mood or an uploaded image, using AI-generated suggestions from Anthropic Claude and song previews from Spotify.

## Features

- Enter a mood (e.g., *happy*, *melancholy*) or upload an image
- Claude AI suggests 10 songs that match the vibe
- Spotify API matches and fetches song details
- Like (👍) to get more similar songs
- Dislike (👎) to replace a song with something different

## Tech Stack

- **Frontend**: React.js, HTML, CSS
- **Backend**: AWS Lambda (Python), AWS Bedrock Claude, AWS Rekognition, API Gateway
- **APIs**: Spotify Web API

## Contributions
- **Frontend**: Kaelyn Sung, Isha Kotalwar
- **Backend**: Isha Kotalwar
- **Design**: Rachel Ruan

## Running Locally

### 1. Clone the repo

```bash
git clone https://github.com/ishakotalwar/CloudHacks-musicgenerator.git
cd CloudHacks-musicgenerator
```

### 2. Set up frontend

```bash
cd frontend
npm install
npm start
```
This should open the app locally.
