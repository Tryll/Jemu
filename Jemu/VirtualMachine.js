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