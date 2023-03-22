
function LSL_C(x, shift) {
    const extended_x = (x << shift) >>> 0;
    const result = extended_x & ((1 << 32) - 1);
    const carry_out = (extended_x & (1 << 32)) !== 0;
    return [result, carry_out];
}

function LSL(x, shift) {
    if (shift === 0) {
        return x;
    } else {
        const [result, _] = LSL_C(x, shift);
        return result;
    }
}

function LSR_C(x, shift) {
        const result = x >>> shift;
        const carry_out = (x & (1 << (shift - 1))) !== 0;
        return [result, carry_out];
}

function LSR(x, shift) {
    if (shift === 0) {
        return x;
    } else {
        const [result, _] = LSR_C(x, shift);
        return result;
    }
}

function ASR_C(x, shift) {
    const result = x >> shift;
    const carry_out = (x & (1 << (shift - 1))) !== 0;
    return [result, carry_out];
}

function ASR(x, shift) {
    if (shift === 0) {
        return x;
    } else {
        const [result, _] = ASR_C(x, shift);
        return result;
    }
}

function ROR_C(x, shift) {
    const m = shift % 32;
    const result = (x >>> m) | ((x << (32 - m)) >>> 0);
    const carry_out = (result & (1 << 31)) !== 0;
    return [result, carry_out];
}

function ROR(x, shift) {
    if (shift === 0) {
        return x;
    } else {
        const [result, _] = ROR_C(x, shift);
        return result;
    }
}

function RRX_C(x, carry_in) {
    const result = (carry_in << 31) | (x >>> 1);
    const carry_out = (x & 1) !== 0;
    return [result, carry_out];
}

function RRX(x, carry_in) {
    const [result, _] = RRX_C(x, carry_in);
    return result;
}

/*function ARMExpandImm(imm12) {
    var [imm32, _] = ARMExpandImm_C(imm12, 0); // You can use 0 or core.flags.C as carry_in depending on the situation.
    return imm32;
}*/

function ARMExpandImm(imm12) {
    const unrotated_value = (imm12 & 0xFF) >>> 0;
    const imm32_amount = 2 * ((imm12 >>> 8) & 0xF);
    const imm32 = (unrotated_value >>> imm32_amount) | ((unrotated_value << (32 - imm32_amount)) >>> 0);
    return imm32;
}


function SignExtend(value, currentWidth, desiredWidth=32) {
    return (value << (desiredWidth - currentWidth)) >> (desiredWidth - currentWidth);
}
    
function BranchRelativePC(core, address) {
    BranchWritePC(core, core.PC + address);
    /*if (core.mode === 'arm') {
        core.PC += address & 0xFFFFFFFC; 
    } else {
        core.PC += (address & 0xFFFFFFFE) | 1;  // Gpt setting least sign 1 to indicate thumb mode
    }*/
}

function BranchWritePC(core, address) {
    if (address & 1) {
        core.mode = 'thumb';
        core.PC = address & ~1; // Clear the least significant bit
    } else {
        core.mode = 'arm';
        core.PC = address & ~3; // Clear the two least significant bits
    }
 /*   if (core.mode === 'arm') {
        core.PC = address & 0xFFFFFFFC; 
    } else  {
        core.PC = (address & 0xFFFFFFFE) | 1;  // Gpt setting least sign 1 to indicate thumb mode
    }*/
}

function ZeroExtend(value, width) {
    return value & ((1 << width) - 1);
}

function UInt(bits) {
    return parseInt(bits, 2);
}


function Shift_C(value, type, amount, carry_in) {
    var result, carry_out;
    if (amount === 0) {
        result = value;
        carry_out = carry_in;
    } else {
        switch (type) {
            case "SRType_LSL":
                [result, carry_out] = LSL_C(value, amount);
                break;
            case "SRType_LSR":
                [result, carry_out] = LSR_C(value, amount);
                break;
            case "SRType_ASR":
                [result, carry_out] = ASR_C(value, amount);
                break;
            case "SRType_ROR":
                [result, carry_out] = ROR_C(value, amount);
                break;
            case "SRType_RRX":
                [result, carry_out] = RRX_C(value, carry_in);
                break;
            default:
                throw new Error("Invalid shift type");
        }
    }

    return {result:result, carry: carry_out};
}

function DecodeImmShift(type, imm5) {
    var shift_t, shift_n;
    switch (type) {
        case 0:
            shift_t = "SRType_LSL"; 
            shift_n = UInt(imm5);
            break;
        case 1:
            shift_t = "SRType_LSR"; 
            shift_n = (imm5 == 0) ? 32 : UInt(imm5);
            break;
        case 2:
            shift_t = "SRType_ASR"; 
            shift_n =  (imm5 == 0) ? 32 : UInt(imm5);
            break;
        case 3:
            shift_t = (imm5 == 0) ? "SRType_RRX" : "SRType_ROR";
            shift_n = (imm5 == 0) ? 1 : Uint(imm5);
            break;
    }
    return {type:shift_t, value:shift_n};
}

function Shift_C_fast(shift_t, value, shift_n, carry_in) {
    var result;
    var carry_out;
  
    switch (shift_t) {
      case SRType_LSL:
        result = value << shift_n;
        carry_out = value & (1 << (32 - shift_n));
        break;
      case SRType_LSR:
        result = value >>> shift_n;
        carry_out = value & (1 << (shift_n - 1));
        break;
      case SRType_ASR:
        result = value >> shift_n;
        carry_out = value & (1 << (shift_n - 1));
        break;
      case SRType_ROR:
        result = (value >>> shift_n) | (value << (32 - shift_n));
        carry_out = (value >>> (shift_n - 1)) & 1;
        break;
      case SRType_RRX:
        result = (value >>> 1) | (carry_in << 31);
        carry_out = value & 1;
        break;
      default:
        throw new Error('Invalid shift type');
    }
  
    return { result: result, carry_out: carry_out };
  }

  
function DecodeRegShift(type) {
   
    switch (type) {
      case '00':
        return "SRType_LSL";
        break;
      case '01':
        return "SRType_LSR";
        break;
      case '10':
        return "SRType_ASR";
        break;
      case '11':
        return "SRType_ROR";
        break;
    }
  
    throw new Error('Invalid shift type');
}


function ARMExpandImm_C(imm12, carry_in) {
    const unrotated_value = ZeroExtend(imm12 & 0xFF, 32);
    const imm32_amount = 2 * UInt((imm12 >>> 8).toString(2));
    const [imm32, carry_out] = Shift_C(unrotated_value, "SRType_ROR", imm32_amount, carry_in);
    return [imm32, carry_out];
}

function ConditionPassed(cond, flags) {
    let result;
    switch (cond & 7) {
      case 0: //"000": 
        result = (flags.Z == 1);
        break;
      case 1: //"001":
        result = (flags.C == 1);
        break;
      case 2: //"010":
        result = (flags.N == 1);
        break;
      case 3: //"011":
        result = (flags.V == 1);
        break;
      case 4: //"100":
        result = (flags.C == 1) && (flags.Z == 0);
        break;
      case 5://"101":
        result = (flags.N == flags.V);
        break;
      case 6://"110":
        result = (flags.N == flags.V) && (flags.Z == 0);
        break;
      case 7://"111":
        result = true;
        break;
      default:
        result = false;
        break;
    }

    if ((cond & 8) == 8 && cond != 15) {  //if (cond.charAt(0) == "1" && cond != "1111") {    
      result = !result;
    }
    return result;
  } 


module.exports={BranchWritePC, BranchRelativePC, SignExtend, ARMExpandImm, DecodeRegShift, DecodeImmShift, ConditionPassed, RRX, RRX_C, ROR, ROR_C, ASR, ASR_C, LSR, LSR_C, LSL, LSL_C, ZeroExtend, UInt, ARMExpandImm_C, Shift_C};