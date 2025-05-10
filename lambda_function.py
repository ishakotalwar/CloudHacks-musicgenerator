import json
import requests
import base64
import os
import boto3
import re
import string

ALPHA_PATTERN = re.compile(r"^[A-Za-z ]+$")

def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        
        if "mood" in body:
            raw_mood = body["mood"]
        elif "image" in body:
            image_data = base64.b64decode(body["image"])
            raw_mood = get_mood_from_image(image_data)
        else:
            return _bad_request("Missing mood or image")

        # validate mood
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

        # get Spotify token
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
            return {"statusCode": 500, "body": json.dumps({"error": "Spotify auth failed"})}

        # search songs
        search_url = f"https://api.spotify.com/v1/search?q={mood}&type=track&limit=5"
        res = requests.get(
            search_url,
            headers={"Authorization": f"Bearer {token}"}
        )

        items = res.json().get("tracks", {}).get("items", [])

        songs = []
        for t in items:
            songs.append({
                "name": t["name"],
                "artist": t["artists"][0]["name"],
                "url": t["external_urls"]["spotify"]
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


def get_mood_from_image(image_data):
    # Detect labels using Rekognition
    rekognition = boto3.client('rekognition')
    labels = rekognition.detect_labels(Image={'Bytes': image_data}, MaxLabels=10)
    label_names = [label['Name'] for label in labels['Labels']]
    print("Detected labels:", label_names)

    # Use Claude 3.5 Haiku on Bedrock
    bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')

    prompt = (
    f"The following image labels were extracted: {', '.join(label_names)}. "
    "Based on these labels, infer a single mood or feeling the image might evoke. "
    "Respond with just one or two descriptive words—no explanations, no extra context.")


    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
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
