import json
import requests
import base64
import os
import boto3
import re

ALPHA_PATTERN = re.compile(r"^[A-Za-z ]+$")
def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        if "mood" in body:
            raw_mood = body['mood']
        elif "image" in body:
            image_data = base64.b64decode(body['image'])
            raw_mood = get_mood_from_image(image_data)
        else:
            return _bad_request("Missing mood or image")
            '''
            return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing 'mood' or 'image'"}) }
            '''

        #-------------ensures that mood is letters only and non-empty string-----------
        if not isinstance(raw_mood, str):
            return _bad_request("'mood' must be a string, e.g. \"chill\"")

        raw_mood = raw_mood.strip()
        if not raw_mood:
            return _bad_request("'mood' must be a non-empty string")

        if not ALPHA_PATTERN.fullmatch(raw_mood):
            return _bad_request(
                "'mood' can contain letters and spaces only (no numbers or symbols)"
            )

        mood = raw_mood.lower()

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
    
    # Use Bedrock (Claude v2) to generate mood
    bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')
    
    prompt = (
        f"Given these image labels: {label_names}, "
        "return the most likely mood from this list ONLY: [chill, relaxing, happy, energetic, romantic, melancholy]. "
        "Only respond with one word from the list. Nothing else."
    )

    body = {
        "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
        "max_tokens_to_sample": 50,
        "temperature": 0.5,
        "top_k": 250,
        "top_p": 1.0,
        "stop_sequences": ["\n\n"]
    }

    response = bedrock.invoke_model(
        modelId="anthropic.claude-v2",  # Claude model
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body)
    )

    result = json.loads(response['body'].read())
    mood = result['completion'].strip().lower()
    return mood

def _bad_request(msg):
    return {
        "statusCode": 400,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"error": msg}),
    }