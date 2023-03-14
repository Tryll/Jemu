const GdbServer = require ("./gdb/gdbServer.js");
const Memory = require('./core/Memory.js');
const VirtualMachine = require("./core/VirtualMachine.js");
const [ARM32, ARMV7L] = require("./architecture/arm/armv7l.js");


const machineLayoutTree = {
    name: 'My Virtual Machine',
    architecture: ARM32,
    platform: ARMV7L,
    numCores: 2,
    memoryMap:
      [
        {
          name: 'rom',
          start: 0x0,
          end: 0x10000,
          permissions: 'rwx'
        },
        {
          name: 'data',
          start: 0x80000000,
          end: 0x800010000,
          permissions: 'rwx'
        },
        {
          name: 'stack',
          start: 0x7ff00000,
          end: 0x7fffffff,
          permissions: 'rwx'
        }
    ]
  };


var vm = new VirtualMachine(machineLayoutTree);
vm.loadFileToAddress(0, "c:\\data\\ios\\emu\\securerom");

var gdb = new GdbServer();
gdb.setup(vm);
//gdb.enableTrace();
gdb.listen();


