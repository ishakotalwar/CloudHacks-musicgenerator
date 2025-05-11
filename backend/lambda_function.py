import json
import requests
import base64
import os
import boto3
import re
import string

ALPHA_PATTERN = re.compile(r"^[A-Za-z ]+$")

def get_spotify_token():
    client_id = os.environ['SPOTIFY_CLIENT_ID']
    client_secret = os.environ['SPOTIFY_CLIENT_SECRET']
    auth_str = f"{client_id}:{client_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()

    token_res = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        headers={"Authorization": f"Basic {b64_auth}"}
    )

    token = token_res.json().get("access_token")
    if not token:
        raise Exception("Failed to retrieve Spotify token")
    return token

def fetch_spotify_details(suggestions, token):
    new_songs = []
    for s in suggestions:
        query = f"{s['title']} {s['artist']}"
        search_url = f"https://api.spotify.com/v1/search?q={requests.utils.quote(query)}&type=track&limit=1"
        res = requests.get(search_url, headers={"Authorization": f"Bearer {token}"})
        track_items = res.json().get("tracks", {}).get("items", [])
        if track_items:
            t = track_items[0]
            new_songs.append({
                "name": t["name"],
                "artist": t["artists"][0]["name"],
                "url": t["external_urls"]["spotify"],
                "image": t["album"]["images"][0]["url"],
                "preview": t.get("preview_url")
            })
    return new_songs

def lambda_handler(event, context):
    try:
        path = event.get("rawPath", "")
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        body = json.loads(event.get('body', '{}'))
        if path.endswith("/similar") and method == "POST":
            return handle_similar_songs(event)

        if "mood" in body:
            raw_mood = body["mood"]
        elif "image" in body:
            image_data = base64.b64decode(body["image"])
            raw_mood = get_mood_from_image(image_data)
        else:
            return _bad_request("Missing mood or image")

        # Validate mood
        if not isinstance(raw_mood, str):
            return _bad_request("'mood' must be a string, e.g. \"chill\"")

        raw_mood = raw_mood.strip()
        raw_mood = ''.join(c for c in raw_mood if c.isalpha() or c.isspace())
        if not raw_mood:
            return _bad_request("'mood' must be a non-empty string")

        if not ALPHA_PATTERN.fullmatch(raw_mood):
            return _bad_request(
                "'mood' can contain letters and spaces only (no numbers or symbols)"
            )

        mood = raw_mood.lower()

        # Get Spotify token
        token = get_spotify_token()

        # Claude generates 5 songs based on mood
        suggestions = get_songs_from_mood_claude(mood)
        songs = []

        for s in suggestions:
            query = f"{s['title']} {s['artist']}"
            search_url = f"https://api.spotify.com/v1/search?q={requests.utils.quote(query)}&type=track&limit=1"

            res = requests.get(search_url, headers={"Authorization": f"Bearer {token}"})
            track_items = res.json().get("tracks", {}).get("items", [])

            if track_items:
                t = track_items[0]
                songs.append({
                "name": t["name"],
                "artist": t["artists"][0]["name"],
                "url": t["external_urls"]["spotify"],
                "image": t["album"]["images"][0]["url"],
                "preview": t.get("preview_url")
                })

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"songs": songs})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


def get_songs_from_mood_claude(mood_input):
    bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')

    prompt = (
        f"The user is feeling '{mood_input}'. Suggest 10 song titles and their artists that fit this mood. "
        "Respond as a list formatted like this:\n"
        "- Song Title by Artist Name\n"
        "Only provide the list. No extra text."
    )

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
        "temperature": 0.7,
        "top_k": 250,
        "top_p": 1.0
    }

    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-haiku-20241022-v1:0",
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body)
    )

    result = json.loads(response["body"].read())
    text = result["content"][0]["text"]
    print("Claude song suggestions:", text)

    suggestions = []
    for line in text.strip().splitlines():
        if " by " in line:
            title, artist = line.split(" by ", 1)
            title = title.lstrip('- ').strip()
            suggestions.append({"title": title.strip(), "artist": artist.strip()})
    return suggestions


def get_mood_from_image(image_data):
    rekognition = boto3.client('rekognition')
    labels = rekognition.detect_labels(Image={'Bytes': image_data}, MaxLabels=10)
    label_names = [label['Name'] for label in labels['Labels']]
    print("Detected labels:", label_names)

    bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')

    prompt = (
        f"The following image labels were extracted: {', '.join(label_names)}. "
        "Based on these labels, infer a single mood or feeling the image might evoke. "
        "Respond with just one or two descriptive words—no explanations, no extra context."
    )

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 50,
        "temperature": 0.5,
        "top_k": 250,
        "top_p": 1.0
    }

    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-5-haiku-20241022-v1:0",
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body)
    )

    result = json.loads(response["body"].read())
    mood_text = result["content"][0]["text"].strip()
    print("Claude mood output:", mood_text)
    return mood_text.lower()


def _bad_request(msg):
    return {
        "statusCode": 400,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"error": msg}),
    }

def handle_similar_songs(event):
    try:
        body = json.loads(event.get("body", "{}"))
        title = body.get("title", "").strip()
        artist = body.get("artist", "").strip()
        existing_titles = {s["title"] for s in body.get("existing", [])}

        if not title or not artist:
            return _bad_request("Missing song title or artist.")

        prompt = (
            f"Suggest 10 songs that are similar to '{title}' by {artist}. "
            "Respond as a list like:\n- Song Title by Artist Name\nOnly return the list."
        )

        bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')
        claude_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 300,
            "temperature": 0.7,
            "top_k": 250,
            "top_p": 1.0
        }

        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-5-haiku-20241022-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(claude_body)
        )

        text = json.loads(response["body"].read())["content"][0]["text"]
        suggestions = []
        for line in text.strip().splitlines():
            if " by " in line:
                song_title, song_artist = line.split(" by ", 1)
                song_title = song_title.strip()
                if song_title not in existing_titles:
                    suggestions.append({"title": song_title, "artist": song_artist.strip()})

        token = get_spotify_token()
        new_songs = fetch_spotify_details(suggestions, token)
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"songs": new_songs})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }