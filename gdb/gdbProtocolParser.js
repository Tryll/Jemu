const EventEmitter = require('events');
const { type } = require('os');

// this should be a function in gdbServer.js

class GdbProtocolParser extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);

    this.socket.on('data', (data) => {
      this.parse(data);
      
    });
  }

  parse(data) {
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

    // Emit packet event
    this.emit('packet', { type:command.slice(0,1),  command: command.slice(1), args:args, raw:inbound });
    
  }
}

module.exports = GdbProtocolParser;