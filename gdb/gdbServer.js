const fs = require('fs');
const net = require('net');
const GdbProtocolParser = require('./GdbProtocolParser.js');

const TARGET_SIGTRAP=5


//https://ftp.gnu.org/old-gnu/Manuals/gdb/html_node/gdb_129.html
// 01 is thread id, TARGET_SIGINT = 2, TARGET_SIGTRAP = 5 
// https://android.googlesource.com/platform/external/qemu/+/3026693afde60618212d0c1db03466535af9d2be/gdbstub.c



class GdbServer {
  static TRACE_CLIENTS = 1;
  static TRACE_INCOMMING = 2;
  static TRACE_OUTGOING  = 4;
  static TRACE_COMMANDS  = 8;
  static TRACE_ALL  = 0xf;
  constructor( ) {
    this.enableTrace();
  }

  enableTrace(flags = GdbServer.TRACE_CLIENTS) {this.traceFlags=flags;}
  disableTrace() {this.traceFlags=0;}

  trace(msg, requireFlag) {
    if (this.traceFlags & requireFlag) console.log(msg);
  }

  traceDir(msg, requireFlag) {
    if (this.traceFlags & requireFlag) console.log(JSON.stringify(msg));
  }

  setup(machine, port = 2456) {
    this.machine=machine;
    this.memory=machine.MMU;
    this.port = port;    
    this.gdbThreadSelect=1;

    this.server = net.createServer((socket) => {
      this.trace('Client connected', GdbServer.TRACE_CLIENTS);
   
      // create parser for this socket
      const parser = new GdbProtocolParser(socket);
      // handle incoming packets from this socket
      parser.on('packet', (packet) => {
        this.trace(`gdb: ${packet.raw}`, GdbServer.TRACE_INCOMMING);
        this.traceDir(packet, GdbServer.TRACE_INCOMMING);
        switch (packet.type) {
          case 'g':
            // read general purpose registers, PSR = 0x400001D3 here rest is 0
            
            var cpu = this.machine.cores[this.gdbThreadSelect-1];
            var regdump="";
            for(var i =0;i<cpu.regs.length; i++) {
              const buf = Buffer.alloc(4);
              buf.writeUInt32LE(cpu.regs[i], 0);
              regdump+=buf.toString('hex').padStart(8,0);
            }
            this.sendPacket(socket,regdump,"+");
            //this.sendPacket(socket,"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d3010040","+");
            //$00000000
           
            break;
          case 'p':
            if (packet.command=="f") { // get program counter 
              this.sendPacket(socket,"00000000","+");
              break;
            }
            // parse register from command and return register value
            this.sendPacket(socket,"00000000","+");
            break;
          
          case 'q':
            this.handleQueryPacket(socket,packet);
            break;

          case 'm':
            // read memory
            const [addrStr, lengthStr] = packet.command.split(',');
            const addr = parseInt(addrStr, 16);
            const length = parseInt(lengthStr, 16);
            const hexData = Buffer.from(this.memory.readBytes(addr,length)).toString('hex');
            this.sendPacket(socket,hexData,"+");
            break;

          case 'M':
            // write memory
            const [writeAddrStr, writeLengthStr] = packet.command.split(',');
            const writeAddr = parseInt(writeAddrStr, 16);
            const writeLength = parseInt(writeLengthStr, 16);
            const bytes = Buffer.from(packet.args[0],"hex");
            this.memory.writeBytes(writeAddr,bytes);
            this.sendPacket(socket,"OK","+");
            break;
          case 'z':
            this.trace("Remove breakpoint ",GdbServer.TRACE_COMMANDS);
            this.traceDir(packet,GdbServer.TRACE_COMMANDS);
            var [bpType, bpAddress, bpLen] = packet.command.split(",");
            this.machine.removeBreakpoint(bpType, parseInt(bpAddress,16), bpLen);
            this.sendPacket(socket,"OK","+");
            break;
          case 'Z':          
            this.trace("Insert breakpoint ",GdbServer.TRACE_COMMANDS);
            this.traceDir(packet,GdbServer.TRACE_COMMANDS);
            var [bpType, bpAddress, bpLen] = packet.command.split(",");
            this.machine.addBreakpoint(bpType, parseInt(bpAddress,16), bpLen);
            this.sendPacket(socket,"OK","+");
            break;
          case '?':
            this.sendPacket(socket,"T05thread:01","+");
            break;
          case 'H':
              if (packet.command[0]=='g') {
                // set active thread / core 
                var thread=packet.command.slice(1);
                this.sendPacket(socket, "OK","+");  
                break;
              }
              this.trace(`Unknown H command: ${packet.command}`, GdbServer.TRACE_COMMANDS);
              
              break;
          case '!':
            // reset machine
            this.sendPacket(socket, "OK","+");
            break;
          case 'v':
                // Machine operations! https://sourceware.org/gdb/onlinedocs/gdb/Packets.html#Packets
            if (packet.command=="Cont?") {
              this.trace("continue", GdbServer.TRACE_COMMANDS);
              // +$vCont;c;C;s;S#62
              this.sendPacket(socket,"vCont;c;C;s;S","+"); // supported commands
              break;
            }
            if (packet.command=="Cont") {  //Step - //+$vCont;s#b8 response +$T05thread:01;#07
              if (packet.args.s) {
                var thread=packet.args.s;

                this.trace("VM Step #"+thread, GdbServer.TRACE_COMMANDS);
                this.gdbThreadSelect=thread;
                var OKorNOT = this.machine.step(thread);
                
                // S for STEP s:XX threadID
              
                this.sendPacket(socket,"T"+ (TARGET_SIGTRAP).toString(16).padStart(2,"0") +"thread:"+this.gdbThreadSelect.toString(16).padStart(2, '0'),"+");   
                //+$T02thread:01
                break;
              } else {
                // continuation;
                this.trace("VM Run",GdbServer.TRACE_COMMANDS);
               
                try {
                  this.machine.continue();
                } catch(error) {
                  this.traceDir(error,GdbServer.TRACE_COMMANDS);
                  this.gdbThreadSelect=parseInt(error.core)+1;
                  this.sendPacket(socket,"T"+ (TARGET_SIGTRAP).toString(16).padStart(2,"0") +"thread:"+(this.gdbThreadSelect).toString(16).padStart(2, '0'),"+");  
                  break;
                }
                
                this.sendPacket(socket, "OK","+");


                // if no immediate return send "+"
                // if bp reached send message:
                // this.sendPacket(socket,"T05thread:01","+");
                
                //thread=1;
                /*this.gdbThreadSelect=thread;
                var OKorNOT = this.machine.step(thread);
                this.sendPacket(socket,"T"+ (TARGET_SIGTRAP).toString(16).padStart(2,"0") +"thread:"+thread.toString(16).padStart(2, '0'),"+");   */

                //this.machine.continue();
                //this.sendPacket(socket, "OK","+");
                break;
              }
            }

            this.sendPacket(socket,"","+");
            break;
          default:
            if (packet.type !='') {
              this.trace(`Unknown packet type:  ${packet.type}`, GdbServer.TRACE_INCOMMING);
            }
            break;
        }
      });


      socket.on('end', () => {
        this.trace('Client disconnected', GdbServer.TRACE_CLIENTS);
      });
    });
  }



    listen() {
        this.server.listen(this.port, () => {
          console.log(`GDB server listening on port ${this.port}`);
        });
    }


    async handleQueryPacket(socket, packet) {
        switch (packet.command) { //+$qfThreadInfo#bb => +$m01#ce
          case 'fThreadInfo':     // Query number of CPU's / Cores 
            this.sendPacket(socket,"m01","+");
            break;
          case 'sThreadInfo': //+$qsThreadInfo#c8 => +$m02#cf, then +$l#6c when no more
            if (!this.threadInfoSent) {
              this.threadInfoSent=true;
              this.sendPacket(socket,"m02","+");
            } else {
              this.threadInfoSent=false;
              this.sendPacket(socket,"l","+");
            }
            
            break;
            
          case 'C': // return current thread Id
            this.sendPacket(socket,"QC"+this.gdbThreadSelect.toString(16).padStart(2, '0'),"+");
            break;
          case 'Supported':
            this.sendPacket(socket,"PacketSize=1000;qXfer:features:read+;vContSupported+;multiprocess+","+");
            break;
          case 'Xfer':
            if (packet.args[0]=="features" && packet.args[1]=="read") {
              try {
                this.trace("Reading "+`architecture\\arm\\schema\\${packet.args[2]}`, GdbServer.TRACE_COMMANDS);
                var schema= fs.readFileSync(`architecture\\arm\\schema\\${packet.args[2]}`, 'utf8');
                var schemaPart=packet.args[3].split(",");
                var start = parseInt(schemaPart[0],16);
                var length = parseInt(schemaPart[1],16);
                var mode="l";
                if (start > schema.length) {
          
                  this.trace ("seeking after file length", GdbServer.TRACE_COMMANDS);
                  this.sendPacket(socket, "-");
                  break;
                }
                if ((start+length)> schema.length) {
                  length=schema.length-start;
                } else 
                if ((start+length) < schema.length) {
                  mode="m";
                }
                var buffer=schema.substring(start,length+start);
                this.trace(`got ${start} and ${length} fetched ${buffer.length} from ${schema.length}`,GdbServer.TRACE_COMMANDS);
                this.sendPacket(socket,mode+buffer,"+");
                break;
              } catch (err) {
                this.trace(err,GdbServer.TRACE_COMMANDS);
                this.sendPacket(socket, "-");
              }
            }
            this.trace("Unknown Xfer request ",GdbServer.TRACE_COMMANDS);
            this.traceDir(packet,GdbServer.TRACE_COMMANDS);
            break;
          case 'Attached':
            this.sendPacket(socket,'+');
            break;
          default:
            this.trace("Unknown query: "+packet.command,GdbServer.TRACE_COMMANDS);
            this.sendPacket(socket,'-');
            break;
        }
      }

      sendPacket(socket,  payload ,prefix="") {
        const packet = Buffer.from(`${payload}`,'ascii');     
        const checksum = packet.reduce((acc, cur) => acc + cur, 0) % 256;
        const checksumStr = checksum.toString(16).toUpperCase().padStart(2, '0');
        const packetStr = packet.toString('ascii');
        
        const packetWithChecksum = Buffer.from(`${prefix}$${payload}#${checksumStr}`);
        
        this.trace(`sending '${packetWithChecksum}'`, GdbServer.TRACE_OUTGOING);
        socket.write(packetWithChecksum);
      }
    
}


module.exports = GdbServer;