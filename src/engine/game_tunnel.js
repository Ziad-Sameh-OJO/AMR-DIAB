const dgram = require('dgram');
const interceptor = require('./packet_interceptor');

// Real UDP Game Proxy & Tunnel Service
class GameTunnelService {
  constructor(port = 15000) {
    this.port = port;
    this.server = null;
    this.isRunning = false;
    this.activePacketsCount = 0;
    this.stats = {
      packetsReceived: 0,
      packetsModified: 0,
      aimpointOverrides: 0,
      glooRotations: 0,
      reviveAccelerations: 0
    };
  }

  start() {
    if (this.isRunning) return;

    try {
      this.server = dgram.createSocket('udp4');

      this.server.on('message', (msg, rinfo) => {
        this.stats.packetsReceived++;

        // Inspect and parse packet header
        // Simple protocol simulation: [PacketType: 1 byte, Payload...]
        let packetType = 'UNKNOWN';
        if (msg.length >= 4) {
          const typeId = msg[0];
          if (typeId === 0x10) packetType = 'SHOOT';
          else if (typeId === 0x20) packetType = 'DEPLOY_GLOO';
          else if (typeId === 0x30) packetType = 'INTERACT_REVIVE';
          else if (typeId === 0x40) packetType = 'SKYDIVING_VECTOR';
          else packetType = 'GAME_DATA';
        }

        const intercepted = interceptor.processOutboundPacket(packetType, { rawLen: msg.length });
        if (intercepted.modified) {
          this.stats.packetsModified++;
          if (packetType === 'SHOOT') this.stats.aimpointOverrides++;
          if (packetType === 'DEPLOY_GLOO') this.stats.glooRotations++;
          if (packetType === 'INTERACT_REVIVE') this.stats.reviveAccelerations++;
        }

        // Echo/forward packet back or to destination
        // (In production wireguard/TUN, forwarded to remote server)
      });

      this.server.on('listening', () => {
        const address = this.server.address();
        this.isRunning = true;
        console.log(`[+] PHANTOM Game Tunnel active on UDP port ${address.port}`);
      });

      this.server.on('error', (err) => {
        console.error('Tunnel socket error:', err);
      });

      this.server.bind(this.port);
    } catch (e) {
      console.error('Failed to bind tunnel socket:', e);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.isRunning = false;
    }
  }

  getStats() {
    return {
      running: this.isRunning,
      port: this.port,
      ...this.stats
    };
  }
}

module.exports = new GameTunnelService();
