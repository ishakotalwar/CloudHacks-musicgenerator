import os, json, time, boto3, base64, requests

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("SpotifyTokens")

CLIENT_ID = os.environ["SPOTIFY_CLIENT_ID"]
CLIENT_SECRET = os.environ["SPOTIFY_CLIENT_SECRET"]
REDIRECT_URI = os.environ["SPOTIFY_REDIRECT_URI"]

BASIC_AUTH = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()


def lambda_handler(event, _):
    body = json.loads(event.get("body") or "{}")
    code = body.get("code")
    verifier = body.get("verifier")
    # requires a JWT authorizer (e.g., Cognito) on your API Gateway stage
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]

    if not code or not verifier:
        return _bad("Missing 'code' or 'verifier'")

    # ── 1. exchange auth-code for tokens ───────────────────────────────────────
    token_res = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        headers={
            "Authorization": f"Basic {BASIC_AUTH}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=10,
    )

    if token_res.status_code != 200:
        return _bad(f"Token exchange failed: {token_res.text}")

    token_json = token_res.json()
    access_token = token_json.get("access_token")
    refresh_token = token_json.get("refresh_token")  # may be None on re-consent
    expires_at = int(time.time()) + token_json["expires_in"] - 60

    # ── 2. upsert into DynamoDB ───────────────────────────────────────────────
    # keep old refresh_token if Spotify didn't send one this time
    update_expr = (
        "SET access_token = :a, expires_at = :e"
        + (", refresh_token = :r" if refresh_token else "")
    )
    expr_vals = {
        ":a": access_token,
        ":e": expires_at,
    }
    if refresh_token:
        expr_vals[":r"] = refresh_token

    table.update_item(
        Key={"user_id": user_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_vals,
    )

    return {"statusCode": 200, "body": "{}"}


# ──────────────────────────────────────────────────────────────────────────────
def _bad(msg: str):
    return {
        "statusCode": 400,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"error": msg}),
    }


def get_user_token(user_id: str) -> str:
    """Fetch a valid access token, refreshing if needed."""
    item = table.get_item(Key={"user_id": user_id}).get("Item")
    if not item:
        raise ValueError("User hasn't connected Spotify yet.")

    # token still valid
    if item["expires_at"] > int(time.time()):
        return item["access_token"]

    # ── refresh flow ──────────────────────────────────────────────────────────
    res = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": item["refresh_token"],
        },
        headers={
            "Authorization": f"Basic {BASIC_AUTH}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=10,
    )

    res.raise_for_status()
    data = res.json()

    new_exp = int(time.time()) + data["expires_in"] - 60
    table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET access_token = :a, expires_at = :e",
        ExpressionAttributeValues={":a": data["access_token"], ":e": new_exp},
    )
    return data["access_token"]
