const MMU = require("./MMU.js");

class VirtualMachine {
  constructor(machineLayoutTree) {
    this.layout = machineLayoutTree;
    this.name = machineLayoutTree.name;
    this.architecture= machineLayoutTree.architecture;
    this.platform= machineLayoutTree.platform;
    this.numCores = machineLayoutTree.numCores;
    this.MMU = new MMU(this, machineLayoutTree.memoryMap, this.platform.endianness);
    this.BreakPoints = [];

    // Create an array of cores
    this.cores = [];
    for (let i = 0; i < this.numCores; i++) {
      let cpu = new this.architecture(this.platform.name+"-"+i,this.platform, this.MMU);
      this.cores.push(cpu);
    }
    // by default enable the first core
    this.cores[0].active=true;
    this.state="idle";
  }

  // Single thread / core step
  step(coreId) {
    this.state="singleStep";
    this.cores[coreId-1].step();
    this.state="idle";
  }

  // Continuation, for all cores, by step'ing each one.
  // This must be a thread .....
  continue() {
    this.state="run";
    try {
      while(true) {        
        for (var core in this.cores) {
          if (this.cores[core].active) {
            try {
              this.cores[core].step();
            } catch(e) {
              throw({error:e, core:core, breakpoint:e.breakpoint});
            }
          }
        }

      }
    } finally {
      this.state="idle";
  //    console.log("VM run error: "+e);
    }
 
  }

  removeBreakpoint(bpType, bpAddress,bpLen) {
    var idx = this.BreakPoints.findIndex(bp =>(bp.type == bpType && bp.address==bpAddress && bp.len == bpLen));
    if (idx!=-1) {
      this.BreakPoints.splice(idx,1);
    }
  }

  addBreakpoint(bpType, bpAddress,bpLen) {
    this.BreakPoints.push({type:bpType, address:bpAddress, len:bpLen});
  }

  loadFile(regionName, filename) {
    this.MMU.loadFile(regionName, filename);
  }

  loadFileToAddress(address, filename) {
    this.MMU.loadFileToAddress(address, filename );
  }
}

module.exports = VirtualMachine;