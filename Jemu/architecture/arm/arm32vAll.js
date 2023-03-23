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




arm_handlers = [
    { encoding:"arm", instruction:"BL<c> <label>", handler:ARM_EmulateBImm},
    { encoding:"arm", instruction:"B<c> <label>", handler:ARM_EmulateBImm},
    { encoding:"arm", instruction:"BX<c> <Rm>", handler: ARM_EmulateBXReg},
    { encoding:"arm", instruction:"SUB{S}<c> <Rd>, <Rn>, #<const>", handler:ARM_EmulateSUBorADRorSUBS},
    { encoding:"arm", instruction:"LDR<c> <Rt>, <label>", handler : ARM_EmulateLDRImm},
    { encoding:"arm", instruction:"CMP<c> <Rn>, <Rm>{, <shift>}", handler : ARM_EmulateCMPReg},
    { encoding:"arm", instruction:"MOV{S}<c> <Rd>, <Rm>", handler: ARM_MovRegReg},
    { encoding:"arm", instruction:"MOV{S}<c> <Rd>, #<const>", handler:ARM_EmulateMovRegConst},
    { encoding:"arm", instruction:"ORR{S}<c> <Rd>, <Rn>, #<const>", handler:ARM_EmulateORRRegConst},
    { encoding:"arm", instruction:"MCR<c> <coproc>, <opc1>, <Rt>, <CRn>, <CRm>{, <opc2>}", handler: ARM_EmulateMCR},
    { encoding:"arm", instruction:"ISB <option>", handler: (core)=> { core.PC+=4 }},
    { encoding:"arm", instruction:"SUB{S}<c> <Rd>, <Rn>, <Rm>{, <shift>}", handler: ARM_SubRegReg},
    { encoding:"arm", instruction:"ADD{S}<c> <Rd>, <Rn>, <Rm>{, <shift>}", handler: ARM_AddRegReg},
    { encoding:"arm", instruction:"LDR<c> <Rt>, [<Rn>{, #+/-<imm12>}]", handler: ARM_LDR_RegImm},
    { encoding:"arm", instruction:"STR<c> <Rt>, [<Rn>{, #+/-<imm12>}]",handler: ARM_STR_RegImm},
    { encoding:"arm", instruction:"MRS<c> <Rd>, <spec_reg>", handler: ARM_MRS_Reg },
    { encoding:"arm", instruction:"MSR<c> <spec_reg>, <Rn>", handler: ARM_EmulateMSR},
    { encoding:"arm", instruction:"BIC{S}<c> <Rd>, <Rn>, #<const>", handler: ARM_EmulateBICRegConst },
]





// SUB{S}<c> <Rd>, <Rn>, #<const>
// This is locked to ADRSubstraction by mask/match
//
// Exmaple ADR Opcode 0xe24f0048 with decoded={"cond":14,"static0":18,"S":0,"Rn":15,"Rd":0,"imm12":72}
//
function ARM_EmulateSUBorADRorSUBS(core, memory, opcode, decoded) {
    var imm32 = ARMExpandImm(decoded.imm12);
    var Rn_value = core.getRegister(decoded.Rn);
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

    core.setRegister(decoded.Rd, result);
}

// @ 0xe59f12c4 (arm) as 'LDR<c> <Rt>, <label>,LDR<c> <Rt>, [PC, #-0]' with {"cond":14,"static0":2,"P":1,"U":1,"static1":0,"W":0,"static2":31,"Rt":1,"imm12":708}
function ARM_EmulateLDRImm(core, memory, opcode, decoded) {
    var t = decoded.Rt;
    var imm32 = decoded.imm12;
    var add = decoded.U === 1;

    // The base register is the program counter (PC)
    var n = 15;

    var address;
    var Rn_value = core.getRegister(n);

    // Since it's PC-relative, align the PC value to a 4-byte boundary before the calculation
    Rn_value = Rn_value & 0xFFFFFFFC;

    address = add ? (Rn_value + imm32) : (Rn_value - imm32);

    core.setRegister(t, memory.readUint32(address));

    // Increment the program counter (core.PC) by 4
    core.PC += 4;
}


// @ 0x00000048 : 0xe1500001 (arm) as 'CMP<c> <Rn>, <Rm>{, <shift>}' with {"cond":14,"static0":21,"Rn":0,"static1":0,"imm5":0,"type":0,"static2":0,"Rm":1}
function ARM_EmulateCMPReg(core, memory, opcode, decoded) {
    var Rn_value = core.getRegister( decoded.Rn);
    var Rm_value = core.getRegister(decoded.Rm);
    var shift = DecodeImmShift(decoded.type, decoded.imm5);
    var shifted = Shift_C(Rm_value, shift.type, shift.value, core.flags.C);
 
    var result = Rn_value - shifted.result;
    core.flags.N = (result & 0x80000000) !== 0;
    core.flags.Z = (result & 0xFFFFFFFF) === 0;
    core.flags.C = Rn_value >= shifted.result;
    core.flags.V = (((Rn_value ^ shifted.result) & (Rn_value ^ result)) & 0x80000000) !== 0;

    core.PC += 4;
}

//@ 0x00004fc0 : 0xe3a024ff (arm) as 'MOV{S}<c> <Rd>, #<const>' with {"cond":14,"static0":29,"S":0,"static1":0,"Rd":2,"imm12":1279}
function ARM_EmulateMovRegConst(core,memory,opcode,decoded) {
    var imm32 = ARMExpandImm(decoded.imm12);
    core.setRegister(decoded.Rd, imm32);

    core.PC += 4;
}


//@ 0x00000078 : 0xe1a0000f (arm) as 'MOV{S}<c> <Rd>, <Rm>' with {"cond":14,"static0":13,"S":0,"static1":0,"Rd":0,"static2":0,"Rm":15}
function ARM_MovRegReg(core,memory,opcode,decoded) {
    var Rm_value =  core.getRegister( decoded.Rm);
    core.setRegister(decoded.Rd, Rm_value);

    // Update condition flags if S bit is set
    if (decoded.S === 1) {
        core.flags.N = (Rm_value & 0x80000000) !== 0; // Negative flag
        core.flags.Z = Rm_value === 0; // Zero flag
        core.flags.C = core.flags.C; // Carry flag remains unchanged
        core.flags.V = core.flags.V; // Overflow flag remains unchanged
    }

    core.PC += 4; // Increment the program counter
}



//@ 0x00004fc4 : 0xe382280f (arm) as 'ORR{S}<c> <Rd>, <Rn>, #<const>' with {"cond":14,"static0":28,"S":0,"Rn":2,"Rd":2,"imm12":2063}
function ARM_EmulateORRRegConst(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister( decoded.Rn);
    var imm32 = ARMExpandImm(decoded.imm12);
    var result = Rn_value | imm32;
    core.setRegister(decoded.Rd, result);

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

//@ 0xee2f2f12 (arm) as 'MCR<c> <coproc>, <opc1>, <Rt>, <CRn>, <CRm>{, <opc2>}' with {"cond":14,"static0":14,"opc1":1,"static1":0,"CRn":15,"Rt":2,"coproc":15,"opc2":0,"static2":1,"CRm":2}
function ARM_EmulateMCR(core, memory, opcode, decoded) {
    var cp = core.coprocessors[decoded.coproc];
  
    cp.handle(core, memory, opcode, decoded);
    core.PC += 4;
}



//0xa000007 (arm) as 'B<c> <label>' with {"cond":0,"static0":10,"imm24":7}
//@ 0x0000004c : 0xeb0013db (arm) as 'BL<c> <label>' with {"cond":14,"static0":11,"imm24":5083}
function ARM_EmulateBImm(core, memory, opcode, decoded) {
    if (ConditionPassed(decoded.cond, core.flags)) {
        var imm32 = SignExtend(decoded.imm24 << 2, 26);

        // If BL save LR
        if (decoded.static0==11) {
            core.LR=core.PC+4;
        }

        BranchWritePC(core,  core.getRegister( 15) + imm32);
    } else {
        core.PC += 4; // Increment the program counter if the condition is not met
    }
}




//@ 0x00004fd4 : 0xe12fff1e (arm) as 'BX<c> <Rm>' with {"cond":14,"static0":1245169,"Rm":14}
function ARM_EmulateBXReg(core, memory, opcode, decoded) {
    // No Conditional Check, ref paper
    var Rm_value =  core.getRegister( decoded.Rm);
    BranchWritePC(core, Rm_value);
}

//@ 0x00000080 : 0xe0400001 (arm) as 'SUB{S}<c> <Rd>, <Rn>, <Rm>{, <shift>}' with {"cond":14,"static0":2,"S":0,"Rn":0,"Rd":0,"imm5":0,"type":0,"static1":0,"Rm":1}
function ARM_SubRegReg(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister(decoded.Rn);
    var Rm_value =  core.getRegister(decoded.Rm);
    var shift = DecodeImmShift(decoded.type, decoded.imm5);
    var shifted = Shift_C(Rm_value, shift.type, shift.value, core.flags.C);

    var result = Rn_value - shifted.result;
    core.setRegister(decoded.Rd, result);

    // Update condition flags if the S bit is set
    if (decoded.S === 1) {
        core.flags.N = (result & 0x80000000) !== 0; // Negative flag
        core.flags.Z = result === 0; // Zero flag
        core.flags.C =  Rn_value >= shifted.result; // Carry flag
        core.flags.V = (((Rn_value ^ shifted.result) & (Rn_value ^ result)) & 0x80000000) !== 0; // Overflow flag
    }

    core.PC += 4; // Increment the program counter
}

// @ 0x00000088 : 0xe0800001 (arm) as 'ADD{S}<c> <Rd>, <Rn>, <Rm>{, <shift>}' with {"cond":14,"static0":4,"S":0,"Rn":0,"Rd":0,"imm5":0,"type":0,"static1":0,"Rm":1}
function ARM_AddRegReg(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister( decoded.Rn);
    var Rm_value =  core.getRegister(decoded.Rm);
    var shift = DecodeImmShift(decoded.type, decoded.imm5);
    var shifted = Shift_C(Rm_value, shift.type, shift.value, core.flags.C);

    var result = Rn_value + shifted.result;
    core.setRegister(decoded.Rd, result);

    // Update condition flags if the S bit is set
    if (decoded.S === 1) {
        core.flags.N = (result & 0x80000000) !== 0; // Negative flag
        core.flags.Z = result === 0; // Zero flag
        core.flags.C = (result >>> 0) < (Rn_value >>> 0); // Carry flag
        core.flags.V = (((Rn_value ^ ~shifted.result) & (Rn_value ^ result)) & 0x80000000) !== 0; // Overflow flag
    }

    core.PC += 4; // Increment the program counter
}

// @ 0x00000094 : 0xe4903004 (arm) as 'LDR<c> <Rt>, [<Rn>{, #+/-<imm12>}],LDR<c> <Rt>, [<Rn>], #+/-<imm12>,LDR<c> <Rt>, [<Rn>, #+/-<imm12>]!' with {"cond":14,"static0":2,"P":0,"U":1,"static1":0,"W":0,"static2":1,"Rn":0,"Rt":3,"imm12":4}
function ARM_LDR_RegImm(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister( decoded.Rn);
    var imm12 = decoded.imm12;
    var address = Rn_value;

    var data = memory.readUint32(address);
    core.setRegister(decoded.Rt, data);

    
    if (decoded.P === 0 || decoded.W === 1) { // Update Rn if P bit is not set or W bit is set

        if (decoded.U === 1) { // Add the immediate value if the U bit is set
            address = Rn_value + imm12;
        } else { // Subtract the immediate value if the U bit is not set
            address = Rn_value - imm12;
        }

        core.setRegister(decoded.Rn, address);
    }



    core.PC += 4; // Increment the program counter
}

// @ 0x0000009c : 0xe4813004 (arm) as 'STR<c> <Rt>, [<Rn>{, #+/-<imm12>}],STR<c> <Rt>, [<Rn>], #+/-<imm12>,STR<c> <Rt>, [<Rn>, #+/-<imm12>]!' with {"cond":14,"static0":2,"P":0,"U":1,"static1":0,"W":0,"static2":0,"Rn":1,"Rt":3,"imm12":4}
function ARM_STR_RegImm(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister( decoded.Rn);
    var Rt_value =  core.getRegister( decoded.Rt);
    var imm12 = decoded.imm12;
    var address = Rn_value;

    memory.writeUint32(address, Rt_value);

    if (decoded.P === 0 || decoded.W === 1) { // Update Rn if P bit is not set or W bit is set
        
        if (decoded.U === 1) { // Add the immediate value if the U bit is set
            address = Rn_value + imm12;
        } else { // Subtract the immediate value if the U bit is not set
            address = Rn_value - imm12;
        }
        
        core.setRegister(decoded.Rn, address);
    }

    core.PC += 4; // Increment the program counter
}


// @ 0x000000a4 : 0xe10f0000 (arm) as 'MRS<c> <Rd>, <spec_reg>' with {"cond":14,"static0":271,"Rd":0,"static1":0}
function ARM_MRS_Reg(core, memory, opcode, decoded) {
    core.setRegister(decoded.Rd, core.CPSR);
    core.PC += 4; // Increment the program counter
}

//@ 0x000000b0 : 0xe121f001 (arm) as 'MSR<c> <spec_reg>, <Rn>' with {"cond":14,"static0":2,"R":0,"static1":2,"mask":1,"static2":3840,"Rn":1}
function ARM_EmulateMSR(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister( decoded.Rn);
    var mask = decoded.mask;

    // If the mask bit is set, update the appropriate fields
    if (mask & 0x1) { // Control field
        core.CPSR = (core.CPSR & ~0xff) | (Rn_value & 0xff);
    }
    if (mask & 0x2) { // Extension field
        core.CPSR = (core.CPSR & ~0xff00) | (Rn_value & 0xff00);
    }
    if (mask & 0x4) { // Status field
        core.CPSR = (core.CPSR & ~0xff0000) | (Rn_value & 0xff0000);
    }
    if (mask & 0x8) { // Flags field
        core.CPSR = (core.CPSR & ~0xff000000) | (Rn_value & 0xff000000);
    }

    core.PC += 4;
}


//@ 0x000000a8 : 0xe3c0001f (arm) as 'BIC{S}<c> <Rd>, <Rn>, #<const>' with {"cond":14,"static0":30,"S":0,"Rn":0,"Rd":0,"imm12":31}
function ARM_EmulateBICRegConst(core, memory, opcode, decoded) {
    var Rn_value =  core.getRegister( decoded.Rn);
    var imm32 = ARMExpandImm(decoded.imm12);
    var result = Rn_value & (~imm32);
    core.setRegister(decoded.Rd, result);

    if (decoded.S === 1) { // Update status flags for BICS
        var isNegative = (result & 0x80000000) !== 0;
        var isZero = result === 0;

        core.flags.N = isNegative;
        core.flags.Z = isZero;
        core.flags.C = false; // Clear carry flag
        core.flags.V = false; // Clear overflow flag
    }

    core.PC += 4;
}






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




// map all handlers
for(var i in arm_handlers) {
    ARMvAll.setOpcodeHandler(arm_handlers[i].encoding, arm_handlers[i].instruction, arm_handlers[i].handler );
}




module.exports = ARMvAll;