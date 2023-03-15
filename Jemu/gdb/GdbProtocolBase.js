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

class GdbProtocolBase {
  
    // data = socket.on.data packet
    // callback a function to receive parsed packets { type:X,  command:XXXX, args:{}, raw:data }
    static Parse(data, callback) {
        if (data=='+') return;
        //    console.log(`packet '${data}' `);
        var inbound=data;
        data=data.slice(data.indexOf("+")+1).toString();
        var message  = data.slice(data.indexOf('$')+1,data.indexOf('#'));
        
        var command="";
        var args={};
        message.split(";").forEach(argument=> {
          const [first, ...firstArgs]= argument.split(":");
          if (command=="") {
            command=first;
            args=firstArgs;
          } else {
            args[first]=firstArgs;
          }  
        });
    
        // call callback
        callback({ type:command.slice(0,1),  command: command.slice(1), args:args, raw:inbound.toString() });
    }
  

    static Send(socket,  payload ,prefix="") {
        const packet = Buffer.from(`${payload}`,'ascii');     
        const checksum = packet.reduce((acc, cur) => acc + cur, 0) % 256;
        const checksumStr = checksum.toString(16).toUpperCase().padStart(2, '0');
        const packetStr = packet.toString('ascii');
        
        const packetWithChecksum = Buffer.from(`${prefix}$${payload}#${checksumStr}`);
        socket.write(packetWithChecksum);
      }
}

module.exports=GdbProtocolBase;