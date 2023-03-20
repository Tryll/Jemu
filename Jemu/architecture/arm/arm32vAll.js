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
const arm_instructions = require("./arm32_instruction_set.js");
const arm32_intrinsics  = require ("./arm32_intrinsics.js");
Object.assign(global, arm32_intrinsics);

const ArmPipelineWidth= 8;
const ThumbPipelineWidth= 4;


function setOpcodeHandler(encodingClass, instruction, handler) {
    for(var inst in this.opcodes) {
        var instDef = this.opcodes[inst];
        if (instDef.encodingClass == encodingClass && instDef.instructions.includes(instruction)) {
            this.opcodes[inst].handler=handler;
        }
    }
}

var ARMvAll = {
    name : "ARMvAll",
    endianness : "little-endian",
    opcodes:arm_instructions,
    setOpcodeHandler : setOpcodeHandler
};


function GetRegister(core, regId) {
    if (regId===15) {
        return core.registers[regId] + ((core.mode=='arm') ? ArmPipelineWidth : ThumbPipelineWidth);
    }
    return core.registers[regId];
}

function ARM_EmulateB(core, memory, opcode, decoded) {
    var imm32 = SignExtend(decoded.imm24 << 2, 26);
    BranchWritePC(core, GetRegister(core, 15) + imm32);
}

// SUB{S}<c> <Rd>, <Rn>, #<const>
// This is locked to ADRSubstraction by mask/match
//
// Exmaple ADR Opcode 0xe24f0048 with decoded={"cond":14,"static0":18,"S":0,"Rn":15,"Rd":0,"imm12":72}
//
function ARM_EmulateSUBorADRorSUBS(core, memory, opcode, decoded) {
    var imm32 = ARMExpandImm(decoded.imm12);
    var Rn_value = GetRegister(core, decoded.Rn);
    var result;
   
    if (decoded.Rn === 15 && decoded.S === 0) { // ADR Subtract variant based on opcode mapping here
        result = (Rn_value - imm32) & 0xFFFFFFFC;
        core.PC += 4;
    } else if (decoded.Rn === 13) { // SUB (SP minus immediate)
        result = (Rn_value - imm32) & 0xFFFFFFFC;
        core.PC += 4;
    } else if (decoded.Rd === 15 && decoded.S === 1) { // SUBS PC, LR and related instructions
        result = (Rn_value - imm32) & 0xFFFFFFFC;
        core.PC = result;
        core.LR = core.PC + 4;
    } else { // SUB or SUBS
        result = (Rn_value - imm32) & 0xFFFFFFFC;
        core.PC += 4;
        if (decoded.S === 1) { // Update status flags for SUBS
            var isNegative = (result & 0x80000000) !== 0;
            var isZero = result === 0;

            core.flags.N = isNegative;
            core.flags.Z = isZero;
            core.flags.C = Rn_value >= imm32; // Update carry flag
            core.flags.V = (((Rn_value ^ imm32) & (Rn_value ^ result)) & 0x80000000) !== 0; // Update overflow flag
        }
    }

    core.registers[decoded.Rd] = result;
}

function ARM_EmulateLDRImm(core, memory, opcode, decoded) {
    var t = decoded.Rt;
    var n = decoded.Rn;
    var imm32 = decoded.imm12;
    var index = decoded.P === 1;
    var add = decoded.U === 1;
    var wback = decoded.P === 0 || decoded.W === 1;

    if (wback && n === t) {
        throw new Error("Unpredictable instruction");
    }

    var address;
    var Rn_value = GetRegister(core, n);
    if (index) {
        address = add ? (Rn_value + imm32) : (Rn_value - imm32);
    } else {
        address = Rn_value;
    }

    core.registers[t] = memory.readDword(address);

    if (wback) {
        core.registers[n] = address;
    }

    core.PC += 4;
}


// @ 0x00000048 : 0xe1500001 (arm) as 'CMP<c> <Rn>, <Rm>{, <shift>}' with {"cond":14,"static0":21,"Rn":0,"static1":0,"imm5":0,"type":0,"static2":0,"Rm":1}
function ARM_EmulateCMPReg(core, memory, opcode, decoded) {
    var Rn_value = GetRegister(core, decoded.Rn);
    var Rm_value = GetRegister(core, decoded.Rm);
    var shift = DecodeImmShift(decoded.type, decoded.imm5);
    var shifted = Shift_C(Rm_value, shift.type, shift.value, core.flags.C);
 
    var result = Rn_value - shifted.result;
    core.flags.N = (result & 0x80000000) !== 0;
    core.flags.Z = (result & 0xFFFFFFFF) === 0;
    core.flags.C = Rn_value >= shifted;
    core.flags.V = (((Rn_value ^ shifted) & (Rn_value ^ result)) & 0x80000000) !== 0;

    core.PC += 4;
}

//@ 0x0000004c : 0xeb0013db (arm) as 'BL<c> <label>' with {"cond":14,"static0":11,"imm24":5083}
function ARM_EmulateBLLabel(core,memory,opcode,decoded) {
    if (ConditionPassed(decoded.cond,core.flags)) {
        var imm32 = GetRegister(core, 15) + SignExtend(decoded.imm24 << 2, 26);

        core.LR = core.PC+4;
        BranchWritePC(core, imm32);
    } else {
        core.PC+4
    }
}

//@ 0x00004fc0 : 0xe3a024ff (arm) as 'MOV{S}<c> <Rd>, #<const>' with {"cond":14,"static0":29,"S":0,"static1":0,"Rd":2,"imm12":1279}
function ARM_EmulateMovRegConst(core,memory,opcode,decoded) {
    var imm32 = ARMExpandImm(decoded.imm12);
    core.registers[decoded.Rd] = imm32;

    core.PC += 4;
}

//@ 0x00004fc4 : 0xe382280f (arm) as 'ORR{S}<c> <Rd>, <Rn>, #<const>' with {"cond":14,"static0":28,"S":0,"Rn":2,"Rd":2,"imm12":2063}
function ARM_EmulateORRRegConst(core, memory, opcode, decoded) {
    var Rn_value = GetRegister(core, decoded.Rn);
    var imm32 = ARMExpandImm(decoded.imm12);
    var result = Rn_value | imm32;
    core.registers[decoded.Rd] = result;

    if (decoded.S === 1) { // Update status flags for ORRS
        var isNegative = (result & 0x80000000) !== 0;
        var isZero = result === 0;

        core.flags.N = isNegative;
        core.flags.Z = isZero;
        core.flags.C = false; // Clear carry flag
        core.flags.V = false; // Clear overflow flag
    }

    core.PC += 4;
}

//@ 0x00004fcc : 0xee2f2f12 (arm) as 'MRC<c> <coproc>, <opc1>, <Rt>, <CRn>, <CRm>{, <opc2>}' with {"cond":14,"static0":14,"opc1":2,"static1":1,"CRn":14,"Rt":5,"coproc":14,"opc2":0,"static2":1,"CRm":2}
// 11101110001011110010111100010010
function ARM_EmulateMRC(core, memory, opcode, decoded) {
    var cp = core.coprocessors[decoded.coproc];
    core.registers[decoded.Rt] = cp.handle(decoded);
    core.PC += 4;
}


arm_handlers = [
    { encoding:"arm", instruction:"B<c> <label>", handler:ARM_EmulateB},
    { encoding:"arm", instruction:"SUB{S}<c> <Rd>, <Rn>, #<const>", handler:ARM_EmulateSUBorADRorSUBS},
    { encoding:"arm", instruction:"LDR<c> <Rt>, [<Rn>{, #+/-<imm12>}]", handler : ARM_EmulateLDRImm},
    { encoding:"arm", instruction:"CMP<c> <Rn>, <Rm>{, <shift>}", handler : ARM_EmulateCMPReg},
    { encoding:"arm", instruction:"BL<c> <label>", handler:ARM_EmulateBLLabel},
    { encoding:"arm", instruction:"MOV{S}<c> <Rd>, #<const>", handler:ARM_EmulateMovRegConst},
    { encoding:"arm", instruction:"ORR{S}<c> <Rd>, <Rn>, #<const>", handler:ARM_EmulateORRRegConst},
    { encoding:"arm", instruction:"MRC<c> <coproc>, <opc1>, <Rt>, <CRn>, <CRm>{, <opc2>}", handler: ARM_EmulateMRC}
]


// map all handlers
for(var i in arm_handlers) {
    ARMvAll.setOpcodeHandler(arm_handlers[i].encoding, arm_handlers[i].instruction, arm_handlers[i].handler );
}
  
module.exports = ARMvAll;