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

var armPipelineWidth=8;
var thumbPipelineWidth=4;


// Opcodes:
// opcode is masked and compared to match
// encoding is processed bitwise [variable:[from,to,equalTo(Optional)]]
// handler is excuted with this as input
var arm_opcodes = [

  // Branch operations:
  { mask: 0x0f000000, match: 0x0a000000, decoder: {cond:[31,28], imm24:[23,0]},  handler:EmulateB, platform: 'ARMvAll', encoding:'EncodingA1', desc:"b #imm24"},
  { mask: 0x0f000000, match: 0x0b000000, decoder: {cond:[31,28], s: [22, 22],  imm24: [23, 0] }, handler:EmulateBL, platform:'ARMvAll', encoding:'EncodingA1',  desc:"bl <label>"},
  { mask: 0x0FFFFFF0, match: 0x012FFF10, decoder: { Rm: [3, 0], }, handler: EmulateBX,  platform: 'ARMvAll', encoding: 'EncodingA1', desc: "BX LR" },
  { mask: 0x0F000000, match: 0x0A000000, decoder: { cond: [31, 28], imm8: [7, 0] },handler: EmulateBEQ, platform: 'ARMvAll', encoding: 'EncodingA1', desc: 'beq <label>'  },


  // ADR / SUB / ADD
  { mask: 0x0fff0000, match: 0x024f0000, decoder: {rd: [15, 12], imm12: [11,0], isSub:[23, 20, 4]}, handler:EmulateADR, platform: 'ARMvAll', encoding:'EncodingA1', desc:"add<c> <Rd>, PC, #<const>"},
  { mask: 0x0fff0000, match: 0x028f0000, decoder: {rd: [15, 12], imm12: [11,0], isSub:[23, 20, 4]}, handler:EmulateADR, platform: 'ARMvAll', encoding:'EncodingA1', desc:"sub<c> <Rd>, PC, #<const>"},
  { mask: 0x0e500000, match: 0x04100000, decoder: {rSrc: [19, 16], rDst: [15, 12], imm12: [11,0]}, handler:EmulateLDRImm, platform: 'ARMvAll', encoding:'EncodingA1', desc:"ldr<c> <Rt> [<Rn> {#+/-<imm12>}]" },
  { mask: 0xFFE0FC10, match: 0xE0400000, decoder: { rd: [15, 12], rn: [19, 16], rm: [3, 0] }, handler: EmulateSUBReg, platform: 'ARMvAll', encoding: 'EncodingA1', desc: 'sub<c> <Rd>, <Rn>, <Rm>' },
  { mask: 0x0FE000F0, match: 0x00800000, decoder: {cond: [31, 28], rd: [15, 12], rn: [19, 16], rm: [3, 0], S: [20, 20]}, handler: EmulateADDReg, platform: 'ARMvAll', encoding: 'EncodingA1', desc: "add{s}<c> <Rd>, <Rn>, <Rm>" },

  // Compare 
  { mask: 0x0ff0f010, match: 0x01500000, decoder: {rn: [19, 16], rm: [3, 0], shift_t: [6, 5], shift_n: [11, 7] }, handler:EmulateCMPReg, platform:'ARMvAll', encoding:'EncodingA1', desc: "cmp<c> <Rn>, <Rm> {,<shift>}"},
  
  // Moves
  { mask: 0x0fef0000, match: 0x03a00000, decoder: {rd: [15, 12], imm12: [11, 0], S: [20, 20]}, handler:EmulateMOVRdImm, platform:"ARMvAll", encoding:"EncodingA1", desc:"mov{s}<c> <Rd>, #<const>"},
  { mask: 0xE3100000, match: 0xE2100000, decoder: {rd: [15, 12], imm12: [11, 0], S: [20, 20]}, handler:EmulateMOVRdImm, platform:"ARMvAll", encoding:"EncodingA1", desc:"mov{s}<c> <Rd>, #<const>"},
  { mask: 0xfff000f0, match: 0xe1a00000, decoder: { rd: [15, 12] }, handler: EmulateMOVRegPC, platform: 'ARMvAll', encoding: 'EncodingA1', desc: "mov<c> <Rd>, PC" },

  // ORR
  { mask: 0x0FE00000, match: 0x03800000, decoder: {cond:[31,28], rd:[15,12], rn:[19,16], imm12:[11,0], S: [20,20]}, handler: EmulateORRImm, platform: 'ARMvAll', encoding: 'EncodingA1', desc: "orr{s}<c> <Rd>, <Rn>, #<const>" },


  // Coprocessors / Syncs
  { mask: 0x0ff00ff0, match: 0x0e200f10, decoder: {cond: [31, 28], opcode_1: [24, 21], crn: [19, 16], rt: [15, 12], cp_num: [11, 8], opcode_2: [7, 4], crm: [3, 0]}, handler: EmulateMCR, platform: 'ARMvAll', encoding: 'EncodingA1', desc: "mcr<c> <coproc>, <opcode_1>, <Rt>, <CRn>, <CRm>, <opcode_2>" },
  { mask: 0x0ff00f10, match: 0x0e100010, decoder: {cond: [31, 28], opcode_1: [24, 21], crn: [19, 16], rt: [15, 12], cp_num: [11, 8], opcode_2: [7, 4], crm: [3, 0]}, handler: EmulateMRC, platform: 'ARMvAll', encoding: 'EncodingA1', desc: "mrc<c> <coproc>, <opcode_1>, <Rt>, <CRn>, <CRm>, <opcode_2>" },
  { mask: 0xFFF0FFFF, match: 0xf570f06f, decoder: {}, handler: (c,m,o,d)=> {c.PC+=4;}, platform: 'ARMvAll', encoding: 'EncodingA1',  desc: "ISB SY"},
  
];


// ARM Pseducode helpers:


function SignExtend(value, currentWidth, desiredWidth=32) {
  return (value << (desiredWidth - currentWidth)) >> (desiredWidth - currentWidth);
}

function BranchRelativePC(core, address) {
  if (core.mode === 'arm') {
    core.PC += address & 0xFFFFFFFC; 
  } else {
    core.PC += (address & 0xFFFFFFFE) | 1;  // Gpt setting least sign 1 to indicate thumb mode
  }
}


function BranchWritePC(core, address) {
  if (core.mode === 'arm') {
    core.PC = address & 0xFFFFFFFC; 
  } else  {
    core.PC = (address & 0xFFFFFFFE) | 1;  // Gpt setting least sign 1 to indicate thumb mode
  }
}


function ConditionPassed(core, opcode, decoded) {
  return core.flags.C==1;
}


function EmulateBX(c, m, o, d)  {
  c.PC = c.regs[d.Rm];
  if (c.PC & 1) {
    c.mode = "thumb";
    c.PC &= ~1;
  } else {
    c.mode = "arm";
  }
}
// Function : EmulateB
// Example decoded: { cond: 14, fixed: 10, imm24: 14 }
// ARM PsuedoCode: 
//  imm32 = SignExtend(imm24:'00', 32);
// f ConditionPassed() then
//    EncodingSpecificOperations();
//    BranchWritePC(PC + imm32);
function EmulateB(core, memory, opcode, decoded) {
    var imm32 = SignExtend(decoded.imm24 << 2, 26);
    BranchWritePC(core, core.PC + imm32 + armPipelineWidth);
}

function EmulateBL(core, memory, opcode, decoded) {
  if (ConditionPassed(core, opcode, decoded)) {
    var imm32 = SignExtend(decoded.imm24 << 2, 26);
    core.LR=core.PC+4;
    BranchWritePC(core, core.PC + imm32 + armPipelineWidth);
  }  else {
    core.PC+=4;
  }
}

function EmulateBEQ(core, memory, opcode, decoded) {
  if (core.flags.Z == 1) {
    var imm32 = SignExtend(decoded.imm8 << 1, 9);
    BranchRelativePC(core, imm32 + armPipelineWidth);
  } else {
    core.PC += 4;
  }
}


//This instruction adds an immediate value to the PC value to form a PC-relative address, and writes the result to the destination register.
// if the value is signed PC value will be lower.
function EmulateADR(core, memory,opcode, decoded) {

  var pcValue = core.PC & 0xFFFFFFFC;
  
  if (decoded.isSub) {
    pcValue-=decoded.imm12;
  } else {
    pcValue+=decoded.imm12;
  }
  core.regs[decoded.rd]=pcValue + armPipelineWidth;
  core.PC+=4;
}

// SUB<c> <Rd>, <Rn>, <Rm>
// This instruction subtracts a register value from another register value, and writes the result to a destination register.
// If the S bit is set, it also updates the condition flags based on the result.
function EmulateSUBReg(core, memory, opcode, decoded) {
  var rn_value = core.regs[decoded.rn];
  var rm_value = core.regs[decoded.rm];
  var result = rn_value - rm_value;
  core.regs[decoded.rd] = result;

  if (decoded.S) {
    core.flags.N = (result & 0x80000000) >>> 31;
    core.flags.Z = (result === 0);
    core.flags.C = (rn_value >>> 0 >= rm_value >>> 0);
    core.flags.V = ((rn_value >>> 31 != rm_value >>> 31) && (rn_value >>> 31 != result >>> 31));
  }

  core.PC += 4;
}

function EmulateADDReg(core, memory, opcode, decoded) {
  var rn_value = core.regs[decoded.rn];
  var rm_value = core.regs[decoded.rm];
  var result = rn_value + rm_value;
  core.regs[decoded.rd] = result;

  if (decoded.S) {
    core.flags.N = (result & 0x80000000) >>> 31;
    core.flags.Z = (result === 0);
    core.flags.C = (result < rn_value || result < rm_value);
    core.flags.V = (((rn_value >>> 31) === (rm_value >>> 31)) && ((rn_value >>> 31) !== (result >>> 31)));
  }

  core.PC += 4;
}


function EmulateLDRImm(core, memory,opcode, decoded) {
  var addr = core.regs[decoded.rSrc] + decoded.imm12 + armPipelineWidth;
  core.regs[decoded.rDst] = memory.readDword(addr);
  core.PC+=4;
}


/// Compare (register) subtracts an optionally-shifted register value from a register value.
// It updates the condition flags based on the result, and discards the result.
function EmulateCMPReg(core,memory,opcode,decoded) {

  var rn_value = core.regs[decoded.rn];
  var rm_value = core.regs[decoded.rm];
  var shift_type = decoded.shift_t;
  var shift_amount = decoded.shift_n;

  // Apply shift operation to second operand if specified
  if (shift_type != 0) {
    // Note: This example implementation only handles logical left shift
    rm_value = rm_value << shift_amount;
  }

  // Perform subtraction and update flags
  var result = rn_value - rm_value;
  core.flags.N = (result & 0x80000000) >>> 31;
  core.flags.Z = (result == 0);
  core.flags.C = (rn_value >>> 0 >= rm_value >>> 0);
  core.flags.V = ((rn_value >>> 31 != rm_value >>> 31) && (rn_value >>> 31 != result >>> 31));

  core.PC+=4;
}

function EmulateMOVRegPC(core, memory, opcode, decoded) {
  core.regs[decoded.rd] = core.PC + 4;
  core.PC += 4;
}

function EmulateMOVRdImm(core, memory, opcode, decoded) {
  var imm32 = decoded.imm12;
  core.regs[decoded.rd] = imm32;

  if (decoded.S) {
    core.flags.N = (imm32 & 0x80000000) >>> 31;
    core.flags.Z = (imm32 === 0);
  }

  core.PC += 4;
}


function EmulateMCR(core, memory, opcode, decoded) {
  // Implement specific coprocessor behavior here
  var cp = core.coprocessors[decoded.cp_num];
  cp.handle(decoded);
  core.PC += 4;
}

function EmulateMRC(core, memory, opcode, decoded) {
  // Implement specific coprocessor behavior here
  var cp = core.coprocessors[decoded.cp_num];
  core.regs[decoded.rt] = cp.handle(decoded);
  core.PC += 4;
}



function EmulateORRImm(core, memory, opcode, decoded) {
  var rn_value = core.regs[decoded.rn];
  var imm32 = decoded.imm12;
  var result = rn_value | imm32;
  core.regs[decoded.rd] = result;

  if (decoded.S) {
    core.flags.N = (result & 0x80000000) >>> 31;
    core.flags.Z = (result === 0);
  }

  core.PC += 4;
}

var ARMv0 = {
  name : "ARM",
  endianness : "little-endian",
  opcodes:arm_opcodes  
}

module.exports = ARMv0;