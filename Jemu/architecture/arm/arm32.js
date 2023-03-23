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

const CoreBase = require("../../CoreBase.js");
const [BitFields, BitSet,BitClear] = require("../../helpers/BitFields.js");
const [SystemControlCoprocessor] = require ('./SystemControlCoproStub.js');

var CPSR_FIELDS = {
  N: 31,
  Z: 30,
  C: 29,
  V: 28,
  Q: 27,
  GE: [19, 16],
  E: 9,
  A: 8,
  I: 7,     // 1 = IRQ interrupts disabled
  F: 6,     // 1 = FIQ interrupts disabled
  T: 5,     // Thumb state
  M: [4,0], // Current processor mode (User, FIQ, IRQ, Supervisor, Abort, Undefined, or System)
};


// wild JS trick to turn 32bit javascript value into unsigned 32 bit
function unsigned(value) {
  return value >>> 0;
}

const ARM32_ProcessorMode = {
  USER: 0,
  FIQ: 1,
  IRQ: 2,
  SUPERVISOR: 3,
  ABORT: 4,
  UNDEFINED: 5,
  SYSTEM: 6
};

// Configure registers:
class ARM32_RegisterBankMap {
  constructor() {
    this.Map=[{ 
        // Let's find the current mode, not by indexing registerBankMap but by bit checking mode property
        mode: ARM32_ProcessorMode.USER | ARM32_ProcessorMode.SYSTEM,
        bank: new Uint32Array(17),
        // the map indicates all values are active from the bank
        map: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
      },
      { // FIQ
        mode: ARM32_ProcessorMode.FIQ,
        bank: new Uint32Array(17),
        // FIQ will have it's own R8-R14 and CPSR/Flags mapped to ARMContext id's like this:
        map: [0,0,0,0,0,0,0,0,0,0,0,0,0, 1, 1, 0, 1]
      },
      { // IRQ
        mode: ARM32_ProcessorMode.IRQ,
        bank: new Uint32Array(17),
        // IRQ, Supervisor,Abort and Undefined modes have R13,R14 and SPSR/flags
        map: [0,0,0,0,0,0,0,0,0,0,0,0,0, 1, 1, 0, 1]
      },
      { // Supervisor
        mode: ARM32_ProcessorMode.SUPERVISOR,
        bank: new Uint32Array(17),
        // IRQ, Supervisor,Abort and Undefined modes have R13,R14 and SPSR/flags
        map: [0,0,0,0,0,0,0,0,0,0,0,0,0, 1, 1, 0, 1]
      },
      { // Abort
        mode: ARM32_ProcessorMode.ABORT,
        bank: new Uint32Array(17),
        // IRQ, Supervisor,Abort and Undefined modes have R13,R14 and SPSR/flags
        map: [0,0,0,0,0,0,0,0,0,0,0,0,0, 1, 1, 0, 1]
      },
      { // Undefined
        mode: ARM32_ProcessorMode.UNDEFINED,
        bank: new Uint32Array(17),
        // IRQ, Supervisor,Abort and Undefined modes have R13,R14 and SPSR/flags
        map: [0,0,0,0,0,0,0,0,0,0,0,0,0, 1, 1, 0, 1]
      }
    ];
  }
}



class ARM32 extends CoreBase  {
  
  static RegisterMap = {
    "R0":0, "R1":1, "R2":2, "R3":3, "R4":4, "R5":5, "R6":6, "R7":7,
    "R8":8, "R9":9, "R10":10, "R11":11, "R12":12, "SP":13, "LR":14, "PC":15,
    "CPSR":16
  };

  static ArmPipelineWidth = 8;
  static ThumbPipelineWidth = 4;
  
  constructor(name, platform, memory) {
    super (name, platform, memory, (new ARM32_RegisterBankMap()).Map);

    // bind register properties to register values
    for (const [key, value] of Object.entries(ARM32.RegisterMap)) {
      Object.defineProperty(this, key, {
        get: () => this.getRegister(value),
        set: (newValue) => this.setRegister(value, newValue),
        enumerable: true,
        configurable: true
      });
    } 

    // set initial values for PC and SP (they are binded)
    this.SP=0;
    this.PC=0;
    this.CPSR = 0x400001D3;

    // initialize basic coprocessors
    this.coprocessors = new Array(16);
    this.coprocessors[15] = new SystemControlCoprocessor(this, memory);
    
    // bind flags to register APSR (16)
    this.flags = BitFields.ByRef(this, "CPSR", CPSR_FIELDS);
    
    this.mode="arm";

  }

  set mode(newMode) {
    this.flags.T = (newMode=='arm') ? 0 : 1;
  }

  get mode() {
    return (this.flags.T) ? "thumb" : "arm";
  }

  getRegister(regId) {
    if (regId===15) {
        return super.getRegister(regId) + ((this.mode=='arm') ? ARM32.ArmPipelineWidth : ARM32.ThumbPipelineWidth);
    }
    return super.getRegister(regId);
  }

  // Perform single Step: Evaluate Instruction
  step() {
    // if core is disabled return
    if (!this.active) return;

    if (this.mode=="arm") {
    
      var opcode=this.memory.readUint32(this.PC);
      var found=false;

      // Walk through the complete opcode set to find an appropraite match by bit mask
      // Would rather have a bitmask based decision tree based on opcode classes for performance, but this is very intuitive. 
      for (var opcodeId in this.opcodes) {
        var opcodeDef=this.opcodes[opcodeId];

        // if instruction is not mode correct ignore.
        if (opcodeDef.encodingClass!='arm') continue;
        
        // Find matching opcode handler 
        if ( unsigned(opcode & opcodeDef.mask) == opcodeDef.match) {

          // decode opcode
          var decoded=BitFields.Parse(opcode, opcodeDef.decoder);

          // Simulate / Evaluate Opcode
          if (!opcodeDef.handler) {
            const  msg=`Unhandled instruction @ 0x${this.PC.toString(16).padStart(8,'0')} : 0x${opcode.toString(16)} (${this.mode}) as '${opcodeDef.instructions}' with ${JSON.stringify(decoded)}`;
            console.log (msg);
            throw(msg);
          } else {

            console.log(`@ 0x${this.PC.toString(16).padStart(8,'0')} : 0x${opcode.toString(16)} (${this.mode}) as '${opcodeDef.instructions}' with ${JSON.stringify(decoded)}`);
            opcodeDef.handler(this, this.memory, opcode, decoded);
          }
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

}

module.exports = ARM32;