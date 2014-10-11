// Generated by CoffeeScript 1.7.1
var CircularBuffer, Connection, Encryption, net;

net = require('net');

Encryption = require('./encryption');

CircularBuffer = require('./circularBuffer');

module.exports = Connection = (function() {
  function Connection(socket, dispatch) {
    this.socket = socket;
    this.dispatch = dispatch;
    this.state = -1;
    this.session1 = new Encryption;
    this.session2 = new Encryption;
    this.clientBuffer = new CircularBuffer;
    this.serverBuffer = new CircularBuffer;
    this.socket.on('data', (function(_this) {
      return function(data) {
        var length, opcode, _results;
        switch (_this.state) {
          case 0:
            if (data.length === 128) {
              data.copy(_this.session1.clientKeys[0]);
              data.copy(_this.session2.clientKeys[0]);
              return _this.client.write(data);
            }
            break;
          case 1:
            if (data.length === 128) {
              data.copy(_this.session1.clientKeys[1]);
              data.copy(_this.session2.clientKeys[1]);
              return _this.client.write(data);
            }
            break;
          case 2:
            _this.session1.decrypt(data);
            _this.clientBuffer.write(data);
            _results = [];
            while (!(_this.clientBuffer.length < 4)) {
              length = _this.clientBuffer.peek(2).readUInt16LE(0);
              if (_this.clientBuffer.length < length) {
                break;
              }
              data = _this.clientBuffer.read(length);
              opcode = data.readUInt16LE(2);
              data = _this.dispatch.handle(opcode, data, false);
              if (data) {
                _this.session2.decrypt(data);
                _results.push(_this.client.write(data));
              } else {
                _results.push(void 0);
              }
            }
            return _results;
        }
      };
    })(this));
    this.socket.on('close', (function(_this) {
      return function() {
        return _this.client.end();
      };
    })(this));
    this.socket.on('error', (function(_this) {
      return function() {
        return _this.client.end();
      };
    })(this));
  }

  Connection.prototype.connect = function(opt) {
    this.client = net.connect(opt);
    this.client.on('connect', (function(_this) {
      return function() {
        _this.remote = _this.socket.remoteAddress + ':' + _this.socket.remotePort;
        console.log("[connection] routing " + _this.remote + " to " + _this.client.remoteAddress + ":" + _this.client.remotePort);
        return _this.state = -1;
      };
    })(this));
    this.client.on('data', (function(_this) {
      return function(data) {
        var length, opcode;
        switch (_this.state) {
          case -1:
            if (1 === data.readUInt32LE(0)) {
              _this.state = 0;
              _this.socket.write(data);
            }
            break;
          case 0:
            if (data.length === 128) {
              data.copy(_this.session1.serverKeys[0]);
              data.copy(_this.session2.serverKeys[0]);
              _this.state = 1;
              _this.socket.write(data);
            }
            break;
          case 1:
            if (data.length === 128) {
              data.copy(_this.session1.serverKeys[1]);
              data.copy(_this.session2.serverKeys[1]);
              _this.session1.init();
              _this.session2.init();
              _this.state = 2;
              _this.socket.write(data);
            }
            break;
          case 2:
            _this.session2.encrypt(data);
            _this.serverBuffer.write(data);
            while (!(_this.serverBuffer.length < 4)) {
              length = _this.serverBuffer.peek(2).readUInt16LE(0);
              if (_this.serverBuffer.length < length) {
                break;
              }
              data = _this.serverBuffer.read(length);
              opcode = data.readUInt16LE(2);
              data = _this.dispatch.handle(opcode, data, true);
              if (data) {
                _this.session1.encrypt(data);
                _this.socket.write(data);
              }
            }
        }
      };
    })(this));
    this.client.on('close', (function(_this) {
      return function() {
        console.log("[connection] " + _this.remote + " disconnected");
        return _this.dispatch.close();
      };
    })(this));
    return this.client.on('error', (function(_this) {
      return function(err) {
        return console.warn(err);
      };
    })(this));
  };

  Connection.prototype.sendClient = function(data) {
    if (this.state === 2) {
      this.session1.encrypt(data);
    }
    return this.socket.write(data);
  };

  Connection.prototype.sendServer = function(data) {
    if (this.state === 2) {
      this.session2.decrypt(data);
    }
    return this.client.write(data);
  };

  return Connection;

})();
