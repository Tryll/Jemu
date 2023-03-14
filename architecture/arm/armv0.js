
//https://developer.arm.com/documentation/ddi0406/c/Application-Level-Architecture/ARM-Instruction-Set-Encoding/ARM-instruction-set-encoding?lang=en
//https://android.googlesource.com/platform/external/lldb/+/bf5a66b/source/Plugins/Instruction/ARM/EmulateInstructionARM.cpp
//https://opensource.apple.com/source/lldb/lldb-167.2/source/Plugins/Instruction/ARM/EmulateInstructionARM.cpp.auto.html
// GetARMOpcodeForInstruction 



// https://web.eecs.umich.edu/~prabal/teaching/eecs373-f10/readings/ARMv7-M_ARM.pdf

var armPipelineWidth=8;
var thumbPipelineWidth=4;


// Opcodes:
// opcode is masked and compared to match
// encoding is processed bitwise [variable:[from,to,equalTo(Optional)]]
// handler is excuted with this as input
var arm_opcodes = [
  { mask: 0x0f000000, match: 0x0a000000, decoder: {cond:[31,28], imm24:[23,0]},  handler:EmulateB, platform: 'ARMvAll', encoding:'EncodingA1', desc:"b #imm24"},
  { mask: 0x0fff0000, match: 0x024f0000, decoder: {rd: [15, 12], imm12: [11,0], isSub:[23, 20, 4]}, handler:EmulateADR, platform: 'ARMvAll', encoding:'EncodingA1', desc:"add<c> <Rd>, PC, #<const>"},
  { mask: 0x0fff0000, match: 0x028f0000, decoder: {rd: [15, 12], imm12: [11,0], isSub:[23, 20, 4]}, handler:EmulateADR, platform: 'ARMvAll', encoding:'EncodingA1', desc:"sub<c> <Rd>, PC, #<const>"},
  { mask: 0x0e500000, match: 0x04100000, decoder: {rSrc: [19, 16], rDst: [15, 12], imm12: [11,0]}, handler:EmulateLDRImmediateARM, platform: 'ARMvAll', encoding:'EncodingA1', desc:"ldr<c> <Rt> [<Rn> {#+/-<imm12>}]" },
  { mask: 0x0ff0f010, match: 0x01500000, decoder: {rn: [19, 16], rm: [3, 0], shift_t: [6, 5], shift_n: [11, 7] }, handler:EmulateCMPReg, platform:'ARMvAll', encoding:'EncodingA1', desc: "cmp<c> <Rn>, <Rm> {,<shift>}"},
  { mask: 0x0f000000, match: 0x0b000000, decoder: {s: [22, 22],  imm24: [23, 0] }, handler:EmulateBLXImmediate, platform:'ARMvAll', encoding:'EncodingA1',  desc:"bl <label>"}
];


// ARM Pseducode helpers:


function SignExtend(value, currentWidth, desiredWidth=32) {
  return (value << (desiredWidth - currentWidth)) >> (desiredWidth - currentWidth);
}

function BranchRelativePC(cpu, address) {
  if (cpu.mode === 'arm') {
    cpu.PC += address & 0xFFFFFFFC; 
  } else {
    cpu.PC += (address & 0xFFFFFFFE) | 1;  // Gpt setting least sign 1 to indicate thumb mode
  }
}


function BranchWritePC(cpu, address) {
  if (cpu.mode === 'arm') {
    cpu.PC = address & 0xFFFFFFFC; 
  } else  {
    cpu.PC = (address & 0xFFFFFFFE) | 1;  // Gpt setting least sign 1 to indicate thumb mode
  }
}

/*
function BranchWritePC(cpu, address) {
  if (cpu.mode=='arm') {
    cpu.PC = address & 0xFFFFFFFC; 
  } else {
    // thumb
    cpu.PC = address & 0xFFFFFFFE;
  }
} */

function ConditionPassed(cpu, opcode, decoded) {
  return true;
}

// Function : EmulateB
// Example decoded: { cond: 14, fixed: 10, imm24: 14 }
// ARM PsuedoCode: 
//  imm32 = SignExtend(imm24:'00', 32);
// f ConditionPassed() then
//    EncodingSpecificOperations();
//    BranchWritePC(PC + imm32);
function EmulateB(cpu, memory, opcode, decoded) {
  if (ConditionPassed(cpu, opcode, decoded)) {
    var imm32 = SignExtend(decoded.imm24 << 2, 26);
    BranchWritePC(cpu, cpu.PC + imm32 + armPipelineWidth);
  }  
}

//This instruction adds an immediate value to the PC value to form a PC-relative address, and writes the result to the destination register.
// if the value is signed PC value will be lower.
function EmulateADR(cpu, memory,opcode, decoded) {

  var pcValue = cpu.PC & 0xFFFFFFFC;
  
  if (decoded.isSub) {
    pcValue-=decoded.imm12;
  } else {
    pcValue+=decoded.imm12;
  }
  cpu.regs[decoded.rd]=pcValue + armPipelineWidth;
  cpu.PC+=4;
}

function EmulateLDRImmediateARM(cpu, memory,opcode, decoded) {
  var addr = cpu.regs[decoded.rSrc] + decoded.imm12 + armPipelineWidth;
  cpu.regs[decoded.rDst] = memory.readDword(addr);
  cpu.PC+=4;
}


/// Compare (register) subtracts an optionally-shifted register value from a register value.
// It updates the condition flags based on the result, and discards the result.
function EmulateCMPReg(cpu,memory,opcode,decoded) {

  var rn_value = cpu.regs[decoded.rn];
  var rm_value = cpu.regs[decoded.rm];
  var shift_type = decoded.shift_t;
  var shift_amount = decoded.shift_n;

  // Apply shift operation to second operand if specified
  if (shift_type != 0) {
    // Note: This example implementation only handles logical left shift
    rm_value = rm_value << shift_amount;
  }

  // Perform subtraction and update flags
  var result = rn_value - rm_value;
  cpu.flags.N = (result & 0x80000000) >>> 31;
  cpu.flags.Z = (result == 0);
  cpu.flags.C = (rn_value >>> 0 >= rm_value >>> 0);
  cpu.flags.V = ((rn_value >>> 31 != rm_value >>> 31) && (rn_value >>> 31 != result >>> 31));

  cpu.PC+=4;
}



function EmulateBLXImmediate(cpu, memory, opcode, decoded) {
  // Per processor mode:
  // Calculate the address of the next instruction, based on the current processor mode
  // Calculate the branch target address, taking into account the current mode of the CPU
  var target;
  var returnAddr;
  if (cpu.mode === 'arm') {
    returnAddr = (cpu.PC + armPipelineWidth) & 0xFFFFFFFC;
    target = returnAddr + SignExtend(decoded.imm24 << 2, 26) + armPipelineWidth;
  } else {  // thumb
    returnAddr = (cpu.PC + thumbPipelineWidth) & 0xFFFFFFFE;
    target = returnAddr + SignExtend(decoded.imm24 << 1, 25);
  }


  // Set the link register to the address of the next instruction
  cpu.LR = returnAddr;

  // Set the PC to the branch target address if C flag is set
  if (cpu.flags.C) {
    BranchRelativePC(cpu, target);
  } else {
    cpu.PC += 4;  // skip over the instruction
  }

  // Switch to Thumb mode if required
  if (decoded.s) {
    console.log("switching to Thumb");
    cpu.mode = 'thumb';
  }
}


var ARMv0 = {
  name : "ARM",
  endianness : "little-endian",
  opcodes:arm_opcodes  
}

module.exports = ARMv0;