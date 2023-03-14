const fs = require("fs");
const Memory = require("./Memory.js");
const MMU = require("./MMU.js");

class VirtualMachine {
  constructor(machineLayoutTree) {
    this.layout = machineLayoutTree;
    this.name = machineLayoutTree.name;
    this.architecture= machineLayoutTree.architecture;
    this.platform= machineLayoutTree.platform;
    this.numCores = machineLayoutTree.numCores;
    this.MMU = new MMU(machineLayoutTree.memoryMap, this.platform.endianness);

    // Create an array of cores
    this.core = [];
    for (let i = 0; i < this.numCores; i++) {
      let cpu = new this.architecture(this.platform.name+"-"+i,this.platform, this.MMU);
      this.core.push(cpu);
    }
  
  }

  step(coreId) {
    this.core[coreId-1].step();
  }

  loadFile(regionName, filename) {
    this.MMU.loadFile(regionName, filename);
  }

  loadFileToAddress(address, filename) {
    this.MMU.loadFileToAddress(address, filename );
  }
}

module.exports = VirtualMachine;