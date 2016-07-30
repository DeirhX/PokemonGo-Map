from . import config
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
    return idinfo['sub']