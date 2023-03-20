const GdbServer = require ("./Jemu/gdb/GdbServer.js");
const VirtualMachine = require("./Jemu/VirtualMachine.js");
const [ARM32, ARMv7] = require("./Jemu/architecture/arm/arm32v7.js");


const machineLayoutTree = {
    name: 'My Virtual Machine',
    architecture: ARM32,
    platform: ARMv7,
    numCores: 2,
    memoryMap:
      [
        {
          name: 'rom',
          start:   0x0,
          end: 0x10000,
          permissions: 'rwx'
        },
        {
          name: 'sram',
          start: 0x10000000,
          end:   0x10100000,
          permissions: 'rwx'
        },
        {
          name: 'data',
          start: 0x80000000,
          end:   0x80010000,
          permissions: 'rwx'
        },
        {
          name: 'stack',
          start: 0x7ff00000,
          end:   0x7fffffff,
          permissions: 'rwx'
        }
    ]
  };


var vm = new VirtualMachine(machineLayoutTree);
vm.loadFileToAddress(0, "c:\\data\\ios\\emu\\securerom");

var gdb = new GdbServer(vm, 2456, GdbServer.TRACE_CLIENTS);
//gdb.enableTrace(GdbServer.TRACE_ALL);
gdb.listen();


