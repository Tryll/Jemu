class BreakpointHandler {
    constructor(socket, memory) {
      this.socket = socket;
      this.memory = memory;
      this.breakpoints = new Set();
    }
  
    handleBreakpointSet(payload) {
      const [type, addrStr, kindStr] = payload.split(',');
      const addr = parseInt(addrStr, 16);
  
      if (type === 'Z0') {
        // hardware breakpoint not supported, send empty response
        this.socket.write('OK');
      } else if (type === 'Z1' && kindStr === '1') {
        // set breakpoint
        this.breakpoints.add(addr);
        this.socket.write('OK');
      } else {
        // invalid breakpoint request, send empty response
        this.socket.write('OK');
      }
    }
  
    handleBreakpointClear(payload) {
      const [type, addrStr, kindStr] = payload.split(',');
      const addr = parseInt(addrStr, 16);
  
      if (type === 'z1' && kindStr === '1') {
        // clear breakpoint
        this.breakpoints.delete(addr);
        this.socket.write('OK');
      } else {
        // invalid breakpoint request, send empty response
        this.socket.write('OK');
      }
    }
  
    isBreakpoint(addr) {
      return this.breakpoints.has(addr);
    }
  }
  
  module.exports = BreakpointHandler;