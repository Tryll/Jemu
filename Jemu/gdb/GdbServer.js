/*
 * Copyright (c) 2023 Tryll AS
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fs = require('fs');
const net = require('net');
const GdbProtocolBase = require('./GdbProtocolBase.js');

const TARGET_SIGTRAP=5

class GdbServer {


  static TRACE_CLIENTS = 1;
  static TRACE_INCOMMING = 2;
  static TRACE_OUTGOING  = 4;
  static TRACE_COMMANDS  = 8;
  static TRACE_ALL  = 0xf;

  enableTrace(flags = GdbServer.TRACE_CLIENTS) {this.traceFlags=flags;}
  disableTrace() {this.traceFlags=0;}


  constructor(machine, port = 2456, traceFlags = GdbServer.TRACE_CLIENTS ) {
    this.machine=machine;
    this.memory=machine.MMU;
    this.port = port;    
    this.gdbThreadSelect=1;

    this.enableTrace(traceFlags);

    this.GdbCommandHandlers = {
      'g': this.handleGeneralRegisters.bind(this),
      'p': this.handleReadRegister.bind(this),
      'P': this.handleWriteRegister.bind(this),
      'q': this.handleQueryPacket.bind(this),
      'm': this.handleReadMemory.bind(this),
      'M': this.handleWriteMemory.bind(this),
      'z': this.handleRemoveBreakpoint.bind(this),
      'Z': this.handleInsertBreakpoint.bind(this),
      '?': this.handleStopReason.bind(this),
      'H': this.handleSetThread.bind(this),
      'v': this.handleMachineOperation.bind(this),
    };

  }

  listen() {
    this.server = net.createServer((socket) => {
      this.trace('Client connected', GdbServer.TRACE_CLIENTS);

      // Set up the onData event handler
      socket.on('data', (data) => {
        this.trace(`gdb incomming: ${data}`, GdbServer.TRACE_INCOMMING);

        GdbProtocolBase.Parse(data, (packet) => {
          this.trace(`gdb incomming parsed: ${JSON.stringify(packet)}`, GdbServer.TRACE_INCOMMING);
          const handler = this.GdbCommandHandlers[packet.type];
          if (handler) {
            handler(socket, packet);
          } else {
            this.trace(`Unknown packet type:  ${packet.type}`, GdbServer.TRACE_INCOMMING);
          }
        })

      });

      socket.on('end', () => {
        this.trace('Client disconnected', GdbServer.TRACE_CLIENTS);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`GDB server listening on port ${this.port}`);
    });
  }


  handleGeneralRegisters(socket, packet) {
    this.trace(`GeneralRegisters ${this.gdbThreadSelect}`, GdbServer.TRACE_COMMANDS);
    const cpu = this.machine.cores[this.gdbThreadSelect-1];
    let regdump = "";
  
    for (let i = 0; i < cpu.registers.length; i++) {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(cpu.registers[i], 0);
      regdump += buf.toString('hex').padStart(8, 0);
    }
  
    GdbProtocolBase.Send(socket, regdump, "+");
  }


  handleReadRegister(socket, packet) {
    const registerIndex = parseInt(packet.command, 16);
    this.trace(`ReadRegister ${registerIndex}`, GdbServer.TRACE_COMMANDS);
  
    if (registerIndex === 15) { // Get program counter
      GdbProtocolBase.Send(socket, "00000000", "+");
      return;
    }
  
    const cpu = this.machine.cores[this.gdbThreadSelect - 1];
    if (registerIndex >= 0 && registerIndex < cpu.registers.length) {
      const registerValue = cpu.registers[registerIndex];
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(registerValue, 0);
      const hexValue = buf.toString('hex').padStart(8, 0);
      GdbProtocolBase.Send(socket, hexValue, "+");
    } else {
      GdbProtocolBase.Send(socket, "00000000", "+");
    }
  }

  handleWriteRegister(socket, packet) {
    const [registerIndexStr, registerValueStr] = packet.command.split(',');
    const registerIndex = parseInt(registerIndexStr, 16);
    const registerValue = parseInt(registerValueStr, 16);
    this.trace(`WriteRegister ${registerIndex} value ${registerValue}`, GdbServer.TRACE_COMMANDS);

    const cpu = this.machine.cores[this.gdbThreadSelect - 1];
    if (registerIndex >= 0 && registerIndex < cpu.registers.length) {
      cpu.registers[registerIndex] = registerValue;
      GdbProtocolBase.Send(socket, "OK", "+");
    } else {
      GdbProtocolBase.Send(socket, "E01", "+"); // Send an error response
    }
  }


  handleReadMemory(socket, packet) {
    const [addrStr, lengthStr] = packet.command.split(',');
    const addr = parseInt(addrStr, 16);
    const length = parseInt(lengthStr, 16);
    this.trace(`ReadMemory 0x${addr.toString(16)}, len 0x${length.toString(16)}`, GdbServer.TRACE_COMMANDS);

    try {
      const memoryData = this.memory.readBytes(addr, length);
      const hexData = Buffer.from(memoryData).toString('hex');
      GdbProtocolBase.Send(socket, hexData, "+");
    } catch (error) {
      this.trace(`Error reading memory: ${error}`, GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "E01", "+"); // Send an error response
    }
  }

  handleWriteMemory(socket, packet) {
    const [writeAddrStr, writeLengthStr] = packet.command.split(',');
    const writeAddr = parseInt(writeAddrStr, 16);
    const writeLength = parseInt(writeLengthStr, 16);
    const bytes = Buffer.from(packet.args[0], "hex");
    this.trace(`WriteMemory 0x${writeAddr.toString(16)}, len 0x${writeLength.toString(16)}`, GdbServer.TRACE_COMMANDS);

    try {
      this.memory.writeBytes(writeAddr, bytes);
      GdbProtocolBase.Send(socket, "OK", "+");
    } catch (error) {
      this.trace(`Error writing memory: ${error}`, GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "E01", "+"); // Send an error response
    }
  }

  handleRemoveBreakpoint(socket, packet) {
    const [bpType, bpAddress, bpLen] = packet.command.split(",");
    const breakpointAddress = parseInt(bpAddress, 16);
    this.trace(`RemoveBreakpoint 0x${breakpointAddress.toString(16)}`, GdbServer.TRACE_COMMANDS);

    try {
      this.machine.removeBreakpoint(bpType, breakpointAddress, bpLen);
      GdbProtocolBase.Send(socket, "OK", "+");
    } catch (error) {
      this.trace(`Error removing breakpoint: ${error}`, GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "E01", "+"); // Send an error response
    }
  }

  handleInsertBreakpoint(socket, packet) {
    const [bpType, bpAddress, bpLen] = packet.command.split(",");
    const breakpointAddress = parseInt(bpAddress, 16);
    this.trace(`InsertBreakpoint 0x${breakpointAddress.toString(16)}`, GdbServer.TRACE_COMMANDS);

    try {
      this.machine.addBreakpoint(bpType, breakpointAddress, bpLen);
      GdbProtocolBase.Send(socket, "OK", "+");
    } catch (error) {
      this.trace(`Error inserting breakpoint: ${error}`, GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "E01", "+"); // Send an error response
    }
  }
  
  handleStopReason(socket, packet) {
    this.trace(`GetStopReason`, GdbServer.TRACE_COMMANDS);
    const stopSignal = TARGET_SIGTRAP;
    const threadId = this.gdbThreadSelect;
    const stopReason = `T${stopSignal.toString(16).padStart(2, "0")}thread:${threadId.toString(16).padStart(2, "0")}`;
    GdbProtocolBase.Send(socket, stopReason, "+");
  }
  
  handleSetThread(socket, packet) {

    const operation = packet.command[0];
    const threadId = parseInt(packet.command.slice(1), 16);
    this.trace(`SetThread (${operation}) ${threadId}`, GdbServer.TRACE_COMMANDS);

    if (operation === "g") {
      // Set active thread / core
      this.gdbThreadSelect = threadId+1;  // why would clients send in 0?
      GdbProtocolBase.Send(socket, "OK", "+");
    } else {
      this.trace(`Unknown H command: ${packet.command}`, GdbServer.TRACE_COMMANDS);
    }
  }

  handleMachineOperation(socket, packet) {
    this.trace(`MachineOperation (${packet.command})`, GdbServer.TRACE_COMMANDS);

    if (packet.command === "Cont?") {
      this.trace("continue", GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "vCont;c;C;s;S", "+"); // supported commands
      return;
    }
  
    if (packet.command === "Cont") {
      if (packet.args.s) {
        const thread = packet.args.s;
        this.trace(`VM Step #${thread}`, GdbServer.TRACE_COMMANDS);
        this.gdbThreadSelect = thread;
        try{
          const OKorNOT = this.machine.step(thread);
        } catch(error) {
          if (!error.breakpoint) {
            console.log(error);
            this.trace("VM Step exception :" +error, GdbServer.TRACE_ALL);
          }
          
        }
        GdbProtocolBase.Send(socket, `T${(TARGET_SIGTRAP).toString(16).padStart(2, "0")}thread:${this.gdbThreadSelect.toString(16).padStart(2, '0')}`, "+");
        
        return;
      } else {
        this.trace("VM Run", GdbServer.TRACE_COMMANDS);
        try {
          this.machine.continue();
        } catch (error) {
          if (!error.breakpoint) {
            console.log(error);
          }
          
          this.gdbThreadSelect = parseInt(error.core) + 1;
          GdbProtocolBase.Send(socket, `T${(TARGET_SIGTRAP).toString(16).padStart(2, "0")}thread:${(this.gdbThreadSelect).toString(16).padStart(2, '0')}`, "+");
          return;
        }
        GdbProtocolBase.Send(socket, "OK", "+");
        return;
      }
    }
  
    GdbProtocolBase.Send(socket, "", "+");
  }
  
  handleQueryPacket(socket, packet) {
    this.trace(`QueryPacket (${packet.command})`, GdbServer.TRACE_COMMANDS);
    if (packet.command === "Supported") {
      const features = [
        "PacketSize=1024",
        "QStartNoAckMode+",
        "qXfer:features:read+",
        "qXfer:memory-map:read+",
        "multiprocess+",
        "vContSupported+",
        "QThreadEvents+",
      ];
      GdbProtocolBase.Send(socket, features.join(";"), "+");
      return;
    }
  
    if (packet.command === "C") {
      GdbProtocolBase.Send(socket, `QC${this.gdbThreadSelect.toString(16).padStart(2, "0")}`, "+");
      return;
    }
  
    if (packet.command === "Attached") {
      this.trace("qAttached", GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "1", "+");
      return;
    }
  
    if (packet.command === "TStatus") {
      this.trace("qTStatus", GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "T0;tnotrun:0", "+");
      return;
    }
  
    if (packet.command === "fThreadInfo") {
      const cores = this.machine.cores;
      let response = "m";
      for (let i = 0; i < cores.length; i++) {
        response += (i + 1).toString(16).padStart(2, "0");
        if (i < cores.length - 1) response += ",";
      }
      GdbProtocolBase.Send(socket, response, "+");
      return;
    }
  
    if (packet.command === "sThreadInfo") {
      GdbProtocolBase.Send(socket, "l", "+");
      return;
    }

    if (packet.command === "qThreadExtraInfo") {
      const threadId = parseInt(packet.args[0], 16);
      if (threadId >= 1 && threadId <= this.machine.cores.length) {
        const threadName = `Core ${threadId}`;
        const hexThreadName = Buffer.from(threadName).toString('hex');
        GdbProtocolBase.send(socket, hexThreadName);
      } else {
        GdbProtocolBase.send(socket, "E01"); // Return an error if the thread ID is not valid
      }
      return;
    }

    if (packet.command === "Xfer") {
      if (packet.args[0] === "features" && packet.args[1] === "read") {
        this.trace(`Xfer Features Read: architecture\\arm\\schema\\${packet.args[2]}`, GdbServer.TRACE_COMMANDS);
        try {
          const schema = fs.readFileSync(`architecture\\arm\\schema\\${packet.args[2]}`, 'utf8');
          const schemaPart = packet.args[3].split(",");
          const start = parseInt(schemaPart[0], 16);
          var length = parseInt(schemaPart[1], 16);
          let mode = "l";
  
          if (start > schema.length) {
            this.trace("seeking after file length", GdbServer.TRACE_COMMANDS);
            GdbProtocolBase.Send(socket, "-");
            return;
          }
  
          if ((start + length) > schema.length) {
            length = schema.length - start;
          } else if ((start + length) < schema.length) {
            mode = "m";
          }
  
          const buffer = schema.substring(start, length + start);
      //    this.trace(`got ${start} and ${length} fetched ${buffer.length} from ${schema.length}`, GdbServer.TRACE_COMMANDS);
          GdbProtocolBase.Send(socket, mode + buffer, "+");
          return;

        } catch (err) {
          this.trace(err, GdbServer.TRACE_COMMANDS);
          GdbProtocolBase.Send(socket, "-");
          return;
        }
      }
  
      this.trace("Unknown Xfer request", GdbServer.TRACE_COMMANDS);
      this.traceDir(packet, GdbServer.TRACE_COMMANDS);
      GdbProtocolBase.Send(socket, "-");
      return;
    }
  
    GdbProtocolBase.Send(socket, "", "+");
  }
  

  trace(msg, requireFlag) {
    if (this.traceFlags & requireFlag) console.log("GDB: "+ msg);
  }

  traceDir(msg, requireFlag) {
    if (this.traceFlags & requireFlag) console.log("GDB: "+ JSON.stringify(msg));
  }

  
}


module.exports = GdbServer;