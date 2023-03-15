const CoreBase = require("../../system/CoreBase.js");
const [BitFields, BitSet,BitClear] = require("../../helpers/BitFields.js");
const [SystemControlCoprocessor] = require ('./SystemControlCoprocessor.js');

var APSR_FIELDS = {
  N: 31,
  Z: 30,
  C: 29,
  V: 28,
  Q: 27,
  GE: [19, 16],
  E: 9,
  A: 8,
  I: 7,
  F: 6,
  T: 5
};


// wild JS trick to turn 32bit javascript value into unsigned 32 bit
function unsigned(value) {
  return value >>> 0;
}


class ARM32 extends CoreBase  {
  static RegisterMap = {
    "R0":0, "R1":1, "R2":2, "R3":3, "R4":4, "R5":5, "R6":6, "R7":7,
    "R8":8, "R9":9, "R10":10, "R11":11, "R12":12, "SP":13, "LR":14, "PC":15,
    "APSR":16
  };
  
  constructor(name, platform, memory) {
    super (name, platform, memory);

    // initialize registers
    this.regs = new Uint32Array(ARM32.RegisterMap.APSR+1);
    this.mapRegisters(ARM32.RegisterMap);    

    // initialize basic coprocessors
    this.coprocessors = new Array(16);
    this.coprocessors[15] = new SystemControlCoprocessor(this, memory);
    
    // bind flags to register APSR (16)
    this.flags = BitFields.ByRef(this, "APSR", APSR_FIELDS);

    // set initial values for PC and SP
    this.SP=0;
    this.PC=0;
    this.APSR = 0x400001D3;

    this.mode="arm";

  }

  // Perform single Step: Evaluate Instruction
  step() {
    // if core is disabled return
    if (!this.active) return;

    if (this.mode=="arm") {
    
      var opcode=this.memory.readDword(this.PC);
      var found=false;

      // Walk through the complete opcode set to find an appropraite match by bit mask
      // Would rather have a bitmask based decision tree based on opcode classes for performance, but this is very intuitive. 
      for (var opcodeId in this.opcodes) {
        var opcodeDef=this.opcodes[opcodeId];
        
        // Find matching opcode handler 
        if ( unsigned(opcode & opcodeDef.mask) == opcodeDef.match) {

          // decode opcode
          var decoded=BitFields.Parse(opcode, opcodeDef.decoder);

          // Simulate / Evaluate Opcode
          console.log(`0x${this.PC.toString(16).padStart(8,'0')} : 0x${opcode.toString(16)} as '${opcodeDef.desc}' with ${JSON.stringify(decoded)}`);
          opcodeDef.handler(this, this.memory, opcode, decoded);
          found=true;
          break;
        }
      }
    
      if(!found) {
        var msg=`0x${this.PC.toString(16).padStart(8,'0')} : 0x${opcode.toString(16)} - unknown instruction`;
        console.log(msg);
        throw(msg);
      }
    }
  }


  // Barrel shift operation
  barrelShift(value, shiftType, shiftAmount) {
    switch (shiftType) {
      case 0: // Logical left shift (LSL)
        return value << shiftAmount;
      case 1: // Logical right shift (LSR)
        return value >>> shiftAmount;
      case 2: // Arithmetic right shift (ASR)
        return value >> shiftAmount;
      case 3: // Rotate right (ROR)
        return (value >>> shiftAmount) | (value << (32 - shiftAmount));
      default:
        throw new Error("Invalid shift type: " + shiftType);
    }
  }

 
}

module.exports = ARM32;