const CoreBase = require("../../system/CoreBase.js");

class SystemControlCoprocessor {
    static RegisterMap = {
      "ID_PFR0": 0, "ID_PFR1": 1,"ID_DFR0": 2,"ID_AFR0": 3, "ID_MMFR0": 4,      "ID_MMFR1": 5,
      "ID_MMFR2": 6, "ID_MMFR3": 7, "ID_ISAR0": 8, "ID_ISAR1": 9, "ID_ISAR2": 10, "ID_ISAR3": 11,
      "ID_ISAR4": 12, "ID_ISAR5": 13, "SCTLR": 14, "ACTLR": 15, "CPACR": 16,
      "C1": 17,"C2": 18,"C3": 19,"C3": 20, "C4": 21, "C5": 22, "C6": 23, "C7": 24, "C8": 25,
      "C9": 26, "C10": 27, "C11": 28, "C12": 29, "C13": 30, "C14": 31,
      "C15": 32
    };
  
    constructor(cpu, mmu) {
      this.cpu=cpu;
      this.mmu=mmu;
      this.regs = new Uint32Array(Object.keys(SystemControlCoprocessor.RegisterMap).length);
      CoreBase.MapRegisters(this, SystemControlCoprocessor.RegisterMap);
    }
  
    handle(opcode){
        console.log ("SystemControlCoProcessor CP15.Handle("+JSON.stringify(opcode)+")");
    }
    // Methods to read and write registers, handle specific operations, etc.
  }


  module.exports=[SystemControlCoprocessor];