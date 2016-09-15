from pogom import config
from oauth2client import client, crypt

# (Receive token by HTTPS POST)

def verify_token(token):
    try:
        idinfo = client.verify_id_token(token, config['OAUTH2_ID'])
        # If multiple clients access the backend server:
        # if idinfo['aud'] not in [ANDROID_CLIENT_ID, IOS_CLIENT_ID, WEB_CLIENT_ID]:
        #    raise crypt.AppIdentityError("Unrecognized client.")
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise crypt.AppIdentityError("Wrong issuer.")
        #if idinfo['hd'] != config['DOMAIN']:
        #    raise crypt.AppIdentityError("Wrong hosted domain.")
    except crypt.AppIdentityError:
        # Invalid token
        return None
    return idinfo

def get_credentials_from_session(session):
    if 'credentials' not in session:
        return None
    credentials = client.OAuth2Credentials.from_json(session['credentials'])
    if credentials.access_token_expired:
        return None
    else:
        return credentials