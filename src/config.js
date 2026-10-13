export const CONFIG = {
  "BRAND_WORDMARK": "PHANTOM",
  "BRAND_TAGLINE": "key login, tunnel status, live match features.",
  "KEY_PREFIX": "PHTM",
  "KEY_PLACEHOLDER": "PHTM-XXXX-XXXX-XXXX",
  "IS_XREG": false,
  "SOCIAL_DISCORD_URL": "https://discord.gg/ptQUycrU3A",
  "SOCIAL_TELEGRAM_URL": "",
  "SOCIAL_WHATSAPP_URL": "",
  "HAPP_IOS_URL": "https://apps.apple.com/us/app/happ-proxy-utility/id6504287215",
  "HAPP_ANDROID_URL": "https://play.google.com/store/apps/details?id=com.happproxy",
  "MARKER_TYPES": [
    "Phantom",
    "Dreamland",
    "Ice Wall",
    "Moco",
    "Clu",
    "Shirou",
    "Iris",
    "Dreki"
  ],
  "DEFAULT_FEATURES": {
    "marker": {
      "enabled": true,
      "type": "Phantom"
    },
    "aimLag": {
      "enabled": false,
      "onFire": false,
      "onScope": false
    },
    "fastLanding": {
      "enabled": false,
      "spot": "Peak"
    },
    "fastRevive": {
      "enabled": false
    },
    "gloo": {
      "enabled": false,
      "yawDeg": 180
    },
    "aimpoint": {
      "enabled": false
    }
  },
  "UPDATE_NOTES": [
    {
      "version": "v1.7",
      "title": "Aim lag is back, next to aimpoint",
      "body": "Aim lag is back, sitting under aimpoint. Run it with aimpoint or on its own. Every feature now carries a short description in your own language."
    },
    {
      "version": "v1.6",
      "title": "Aimpoint replaces aim lag",
      "body": "New aimpoint: your aim assist locks onto the neck instead of the chest, so shots that used to hit the body land as headshots. One switch, works on every gun, applies from the start of your next match. Aim lag is gone from the app - aimpoint replaces it."
    },
    {
      "version": "v1.5",
      "title": "Aim lag paused",
      "body": "Aim lag is marked RISK and switched off in the app while we fix it — the toggle is greyed out for everyone. Every other feature is unaffected."
    },
    {
      "version": "v1.4",
      "title": "Fast revive + rebuilt aim lag",
      "body": "New fast revive: pick a knocked teammate up in about 100 ms instead of ~3 seconds. Aim lag was rebuilt to freeze the target's position instead of dropping packets, so it no longer stutters your own movement."
    },
    {
      "version": "v1.3",
      "title": "Smarter server picking",
      "body": "Your config now picks the node with the lowest real ping to your own match server, measured every 15 minutes, not the closest one on a map. A Delhi node joined Singapore and France. Failed key imports now show the reason (expired, revoked, HWID mismatch) right in the app instead of failing silently."
    },
    {
      "version": "v1.2",
      "title": "Fast landing + Europe node",
      "body": "Added fast landing: drop straight onto a saved waypoint instead of following the flight path. A France node was added for Europe, North Africa and the Middle East, and tunnels no longer drop on a database blip."
    },
    {
      "version": "v1.1",
      "title": "Device lock + stability",
      "body": "Keys are locked to one device (reset it yourself from the site) and each account gets its own tunnel. Fixed markers dying after the first match and sessions colliding between accounts."
    },
    {
      "version": "v1.0",
      "title": "Initial release",
      "body": "PHANTOM is live: key-based access, live marker and aim lag toggles, and one-tap Happ setup."
    }
  ]
};
export default CONFIG;
