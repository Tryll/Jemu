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