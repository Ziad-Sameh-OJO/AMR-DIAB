// Packet Interceptor & Game Feature Processor
// Implements active logic for Aimpoint, Aim Lag, Gloo Rotation, Fast Revive, Fast Landing, and Markers

class PacketInterceptor {
  constructor() {
    this.features = {
      marker: { enabled: true, type: 'Phantom' },
      aimLag: { enabled: false, onFire: false, onScope: false },
      fastLanding: { enabled: false, spot: 'Peak' },
      fastRevive: { enabled: false },
      gloo: { enabled: false, yawDeg: 180 },
      aimpoint: { enabled: false }
    };

    // Live match simulation state
    this.playerState = {
      posX: 0,
      posY: 0,
      posZ: 0,
      yaw: 0,
      pitch: 0,
      isFiring: false,
      isScoping: false,
      health: 200,
      kills: 6
    };

    // Simulated active match pawns (Free Fire / Battle Royale entities)
    this.pawns = [
      { id: 101, name: 'Enemy_Viper', team: 2, distance: 34, health: 180, x: 22, y: 15, z: 0, bone: 2, frozen: false },
      { id: 102, name: 'Shadow_Ninja', team: 3, distance: 58, health: 200, x: -35, y: 42, z: 2, bone: 2, frozen: false },
      { id: 103, name: 'Sniper_Ghost', team: 4, distance: 112, health: 90, x: 85, y: -68, z: 12, bone: 2, frozen: false },
      { id: 104, name: 'Rush_King', team: 5, distance: 18, health: 65, x: 8, y: -16, z: 0, bone: 2, frozen: false }
    ];

    // Background match ticker
    this.ticker = setInterval(() => this.updateGameState(), 100);
  }

  setFeatures(newFeatures) {
    this.features = { ...this.features, ...newFeatures };
  }

  getFeatures() {
    return this.features;
  }

  // Intercept & process outbound game packet
  processOutboundPacket(packetType, payload) {
    const res = { type: packetType, modified: false, payload: { ...payload } };

    // 1. Aimpoint Interceptor: Redirects hit / aim bone from Chest (2) to Neck (3) / Head (4)
    if (this.features.aimpoint && this.features.aimpoint.enabled) {
      if (packetType === 'SHOOT' || packetType === 'AIM_LOCK' || packetType === 'BULLET_HIT') {
        res.payload.targetBone = 3; // Neck bone ID
        res.payload.boneOffsetZ = 0.42; // Elevated headshot vector
        res.payload.criticalMultiplier = 2.5;
        res.modified = true;
      }
    }

    // 2. Gloo Wall Deployment Interceptor: Rotates wall placement yaw
    if (this.features.gloo && this.features.gloo.enabled) {
      if (packetType === 'DEPLOY_GLOO' || packetType === 'GRENADE_THROW') {
        const offsetDeg = this.features.gloo.yawDeg || 180;
        const currentYaw = payload.yaw || this.playerState.yaw;
        const adjustedYaw = (currentYaw + offsetDeg) % 360;
        res.payload.yaw = adjustedYaw;
        res.payload.rotationOffset = offsetDeg;
        res.modified = true;
      }
    }

    // 3. Fast Revive Interceptor: Overrides teammate revive duration to 100ms
    if (this.features.fastRevive && this.features.fastRevive.enabled) {
      if (packetType === 'INTERACT_REVIVE') {
        res.payload.durationMs = 100;
        res.payload.instantComplete = true;
        res.modified = true;
      }
    }

    // 4. Fast Landing Interceptor: Straight waypoint trajectory override
    if (this.features.fastLanding && this.features.fastLanding.enabled) {
      if (packetType === 'SKYDIVING_VECTOR') {
        res.payload.dropSpeed = 120.0; // Terminal velocity
        res.payload.targetWaypoint = this.features.fastLanding.spot || 'Peak';
        res.payload.straightDrop = true;
        res.modified = true;
      }
    }

    return res;
  }

  // Intercept inbound server packet (Enemy telemetry stream)
  processInboundPacket(packetType, payload) {
    // Aim Lag Engine: Buffer / freeze target movement stream while shooting or scoping
    if (this.features.aimLag && this.features.aimLag.enabled) {
      const shouldLag = (this.features.aimLag.onFire && this.playerState.isFiring) ||
                        (this.features.aimLag.onScope && this.playerState.isScoping);

      if (shouldLag && packetType === 'ENTITY_MOVEMENT_UPDATE') {
        // Hold enemy position unchanged on player's client for steady aim
        payload.freezeMovement = true;
        payload.velocityX = 0;
        payload.velocityY = 0;
        return { modified: true, payload };
      }
    }

    return { modified: false, payload };
  }

  // Periodic game simulation step (for Radar and Live Telemetry)
  updateGameState() {
    for (const p of this.pawns) {
      // Simulate slight realistic movement unless aimLag is active and firing
      const isAimLagActive = this.features.aimLag?.enabled && 
                             ((this.features.aimLag.onFire && this.playerState.isFiring) || 
                              (this.features.aimLag.onScope && this.playerState.isScoping));

      if (!isAimLagActive) {
        p.x += (Math.random() - 0.5) * 0.8;
        p.y += (Math.random() - 0.5) * 0.8;
        p.distance = Math.round(Math.hypot(p.x, p.y));
        p.frozen = false;
      } else {
        p.frozen = true;
      }

      // Aimpoint target lock
      if (this.features.aimpoint && this.features.aimpoint.enabled) {
        p.targetedBone = 'Neck (Bone 3)';
      } else {
        p.targetedBone = 'Chest (Bone 2)';
      }

      // Marker assignment
      p.marker = this.features.marker?.enabled ? this.features.marker.type : null;
    }
  }

  // Get formatted game state for Live Radar / Overlay
  getLiveTelemetry() {
    return {
      features: this.features,
      player: this.playerState,
      glooRotation: this.features.gloo?.enabled ? this.features.gloo.yawDeg : 0,
      aimpointActive: !!this.features.aimpoint?.enabled,
      aimLagActive: !!this.features.aimLag?.enabled,
      pawns: this.pawns
    };
  }
}

module.exports = new PacketInterceptor();
