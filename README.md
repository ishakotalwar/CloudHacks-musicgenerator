# CloudHacks Music Moodboard

A React + AWS-powered site that recommends songs based on your mood or an uploaded image, using AI-generated suggestions from Anthropic Claude and song previews from Spotify.

## Features

- Enter a mood (e.g., *happy*, *melancholy*) or upload an image
- Claude AI suggests 10 songs that match the vibe
- Spotify API matches and fetches song details
- Like (👍) to get more similar songs
- Dislike (👎) to replace a song with something different

## Tech Stack

- **Frontend**: React.js
- **Backend**: AWS Lambda (Python), AWS Bedrock Claude, AWS Rekognition
- **APIs**: Spotify Web API

## Running Locally

### 1. Clone the repo

```bash
git clone https://github.com/ishakotalwar/CloudHacks-musicgenerator.git
cd CloudHacks-musicgenerator

```markdown
2. Set up frontend
cd frontend
npm install
npm run dev
npm start

