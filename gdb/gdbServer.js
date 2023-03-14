const fs = require('fs');
const net = require('net');
const GdbProtocolParser = require('./GdbProtocolParser');
const BreakpointHandler = require('../core/BreakpointHandler.js');

const TARGET_SIGTRAP=5


//https://ftp.gnu.org/old-gnu/Manuals/gdb/html_node/gdb_129.html


class GdbServer {
  constructor( ) {
    this.disableTrace();
  }

  enableTrace() {this.traceEnabled=null;}
  disableTrace() {this.traceEnabled=false;}


  setup(machine, port = 2456) {
    this.machine=machine;
    this.memory=machine.MMU;
    this.port = port;    
    this.gdbThreadSelect=1;

    this.server = net.createServer((socket) => {
      console.log( 'Client connected');
   
      // create parser for this socket
      const parser = new GdbProtocolParser(socket);
      // handle incoming packets from this socket
      parser.on('packet', (packet) => {
        (this.traceEnabled) ?? console.log(`gdb: ${packet.raw}`);
        (this.traceEnabled) ?? console.dir(packet);
        switch (packet.type) {
          case 'g':
            // read general purpose registers, PSR = 0x400001D3 here rest is 0
            
            var cpu = this.machine.core[this.gdbThreadSelect-1];
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
          case 'Z':
          case 'z':
            (this.traceEnabled) ?? console.log("handle breapoint ");
            (this.traceEnabled) ?? console.dir(packet);
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
              (this.traceEnabled) ?? console.log(`Unknown H command: ${packet.command}`);
              
              break;
          case '!':
            // reset machine
            this.sendPacket(socket, "OK","+");
            break;
          case 'v':
                // Machine operations! https://sourceware.org/gdb/onlinedocs/gdb/Packets.html#Packets
            if (packet.command=="Cont?") {
              (this.traceEnabled) ?? console.log( "continue");
              // +$vCont;c;C;s;S#62
              this.sendPacket(socket,"vCont;c;C;s;S","+"); // supported commands
              break;
            }
            if (packet.command=="Cont") {  //Step - //+$vCont;s#b8 response +$T05thread:01;#07
              if (packet.args.s) {

                var thread=packet.args.s;

                (this.traceEnabled) ?? console.log("Stepping thread "+thread);
                this.gdbThreadSelect=thread;
                var OKorNOT = this.machine.step(thread);
                
                // S for STEP s:XX threadID
              
                this.sendPacket(socket,"T"+ (TARGET_SIGTRAP).toString(16).padStart(2,"0") +"thread:"+thread.toString(16).padStart(2, '0'),"+");   // 01 is thread id, TARGET_SIGINT = 2, TARGET_SIGTRAP = 5 https://android.googlesource.com/platform/external/qemu/+/3026693afde60618212d0c1db03466535af9d2be/gdbstub.c
                //+$T02thread:01
              }
              
              break;
            }

            this.sendPacket(socket,"","+");
            break;
          default:
            if (packet.type !='') {
              console.log(`Unknown packet type:  ${packet.type}`);
            }
            break;
        }
      });


      socket.on('end', () => {
        console.log('Client disconnected');
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
                (this.traceEnabled) ?? console.log("Reading "+`architecture\\arm\\schema\\${packet.args[2]}`);
                var schema= fs.readFileSync(`architecture\\arm\\schema\\${packet.args[2]}`, 'utf8');
                var schemaPart=packet.args[3].split(",");
                var start = parseInt(schemaPart[0],16);
                var length = parseInt(schemaPart[1],16);
                var mode="l";
                if (start > schema.length) {
          
                  (this.traceEnabled) ?? console.log("seeking after file length");
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
                (this.traceEnabled) ?? console.log(`got ${start} and ${length} fetched ${buffer.length} from ${schema.length}`);
                this.sendPacket(socket,mode+buffer,"+");
                break;
              } catch (err) {
                (this.traceEnabled) ?? console.log(err);
                this.sendPacket(socket, "-");
              }
            }
            (this.traceEnabled) ?? console.log("Unknown Xfer request ");
            (this.traceEnabled) ?? console.dir(packet);
            break;
          case 'Attached':
            this.sendPacket(socket,'+');
            break;
          default:
            (this.traceEnabled) ?? console.log("Unknown query: "+packet.command);
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
        
        (this.traceEnabled) ?? console.log(`sending '${packetWithChecksum}'`);
        socket.write(packetWithChecksum);
      }
    
}


module.exports = GdbServer;