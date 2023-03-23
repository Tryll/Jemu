
function ARMExpandImm(imm12) {
    const unrotated_value = (imm12 & 0xFF) >>> 0;
    const imm32_amount = 2 * ((imm12 >>> 8) & 0xF);
    const imm32 = (unrotated_value >>> imm32_amount) | ((unrotated_value << (32 - imm32_amount)) >>> 0);
    return imm32;
}


function SignExtend(value, currentWidth, desiredWidth=32) {
    return (value << (desiredWidth - currentWidth)) >> (desiredWidth - currentWidth);
}
    

function BranchWritePC(core, address) {
    if (address & 1) {
        core.mode = 'thumb';
        core.PC = address & ~1; // Clear the least significant bit
    } else {
        core.mode = 'arm';
        core.PC = address & ~3; // Clear the two least significant bits
    }
}


function DecodeImmShift(type, imm5) {
    var shiftName = ['LSL', 'LSR', 'ASR', 'ROR'];
    var shiftType = shiftName[type];
    var shiftValue = imm5;

    if (type === 0 && imm5 === 0) {
        shiftValue = 0;
    } else if ((type === 1 || type === 2) && imm5 === 0) {
        shiftValue = 32;
    } else if (type === 3) {
        if (imm5 === 0) {
            shiftType = 'RRX';
            shiftValue = 1;
        } else {
            shiftValue = imm5;
        }
    }

    return {
        type: shiftType,
        value: shiftValue
    };
}

function Shift_C(value, type, amount, carry_in) {
    let carry_out;
    let result;

    if (amount === 0) {
        return { result: value, carry_out: carry_in };
    }

    switch (type) {
        case 'LSL':
            carry_out = (amount === 0) ? carry_in : (value >>> (32 - amount)) & 1;
            result = value << amount;
            break;

        case 'LSR':
            carry_out = (amount === 0) ? carry_in : (value >>> (amount - 1)) & 1;
            result = value >>> amount;
            break;

        case 'ASR':
            carry_out = (amount === 0) ? carry_in : (value >> (amount - 1)) & 1;
            result = value >> amount;
            break;

        
        case 'ROR':
            amount %= 32;
            if (amount === 0) {
                carry_out = value >>> 31;
            } else {
                carry_out = (value >>> (amount - 1)) & 1;
                result = (value >>> amount) | (value << (32 - amount));
            }
            break;

        case 'RRX':
            carry_out = value & 1;
            result = (value >>> 1) | (carry_in << 31);
            break;
    
        default:
            console.error('Invalid shift type:', type);
            return { result: value, carry_out: 0 };
    }
    
     return { result: result >>> 0, carry_out: carry_out };
}


function ConditionPassed(cond, flags) {
    let result;
    switch (cond) {
        case 0: // "0000": EQ (Equal)
            result = (flags.Z == 1);
            break;
        case 1: // "0001": NE (Not Equal)
            result = (flags.Z == 0);
            break;
        case 2: // "0010": CS / HS (Carry Set / Unsigned Higher or Same)
            result = (flags.C == 1);
            break;
        case 3: // "0011": CC / LO (Carry Clear / Unsigned Lower)
            result = (flags.C == 0);
            break;
        case 4: // "0100": MI (Minus / Negative)
            result = (flags.N == 1);
            break;
        case 5: // "0101": PL (Plus / Positive or Zero)
            result = (flags.N == 0);
            break;
        case 6: // "0110": VS (Overflow)
            result = (flags.V == 1);
            break;
        case 7: // "0111": VC (No Overflow)
            result = (flags.V == 0);
            break;
        case 8: // "1000": HI (Unsigned Higher)
            result = (flags.C == 1) && (flags.Z == 0);
            break;
        case 9: // "1001": LS (Unsigned Lower or Same)
            result = (flags.C == 0) || (flags.Z == 1);
            break;
        case 10: // "1010": GE (Signed Greater Than or Equal)
            result = (flags.N == flags.V);
            break;
        case 11: // "1011": LT (Signed Less Than)
            result = (flags.N != flags.V);
            break;
        case 12: // "1100": GT (Signed Greater Than)
            result = (flags.Z == 0) && (flags.N == flags.V);
            break;
        case 13: // "1101": LE (Signed Less Than or Equal)
            result = (flags.Z == 1) || (flags.N != flags.V);
            break;
        case 14: // "1110": AL (Always)
            result = true;
            break;
        case 15: // "1111": NV (Never) - This condition is not used in ARM mode and should always return false.
            result = false;
            break;
        default:
            result = false;
            break;
    }
    
    return result;
}

module.exports={BranchWritePC, SignExtend, ARMExpandImm, DecodeImmShift, ConditionPassed,  Shift_C};