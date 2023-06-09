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

function BitSet(value, bitId) {
  return value | (1 << bitId);
}

function BitClear(value, bitId) {
  return value & ~(1 << bitId);
}

class BitFields {


        
      /*
      example use:
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

        var obj = {
          myHolder= 0x123556;
        }

        var myHolderFlags = new Flags(obj, "myHolder", APSR_FIELDS);
        myHolderFlags.C=true;
      */

      /* Maps a list of bit-flags onto a variable by reference, any update will map to referenced variable */
    static ByRef(flagOwnerObject, flagVarName, bitFieldMap) {
      var byRefObj = {};
      byRefObj.flagOwnerObject = flagOwnerObject;
      byRefObj.flagVarName = flagVarName;
      for (const [flag, bit] of Object.entries(bitFieldMap)) {
        if (typeof bit === 'number') {
          Object.defineProperty(byRefObj, flag, {
            get: () => !!(byRefObj.flagOwnerObject[byRefObj.flagVarName] & (1 << bit)),
            set: (value) => {
              byRefObj.flagOwnerObject[byRefObj.flagVarName] = (value ? BitSet : BitClear)(byRefObj.flagOwnerObject[byRefObj.flagVarName], bit);
            },
            enumerable: true
          });
        } else if (Array.isArray(bit)) {
          // Handle multi-bit flags (e.g. GE)
          Object.defineProperty(byRefObj, flag, {
            get: () => (byRefObj.flagOwnerObject[byRefObj.flagVarName] >> bit[0]) & ((1 << (bit[1] - bit[0] + 1)) - 1),
            set: (value) => {
              const mask = ((1 << (bit[1] - bit[0] + 1)) - 1) << bit[0];
              byRefObj.flagOwnerObject[byRefObj.flagVarName] = (byRefObj.flagOwnerObject[byRefObj.flagVarName] & ~mask) | ((value << bit[0]) & mask);
            },
            enumerable: true
          });
        }
      }
      return byRefObj;
    }


    // Parses opcode based on bitFieldMap
    // The Field map is length based, each entry has a length and are in order high to low
    // Example list of fields and sizes: {"static0":{"len":10,"eq":261},"Rm":4,"Rdn":4}
    static Parse(opcode, bitFieldMap, opcodeWidth=31) {
      var decoded={};      
      var currentBit=opcodeWidth;
      for (var name in bitFieldMap){

        var decoderBits=bitFieldMap[name];
        if (decoderBits.len) {
          decoderBits=decoderBits.len; // if object grab length
        }
        decoderBits--; // bits align
        var bits=[currentBit, currentBit-decoderBits];
        currentBit-=(decoderBits+1); // move right
        decoded[name]=BitFields.DecodeBitValue(opcode, bits);
        
      }
      return decoded;
    }

    // takes a number and extract the bit range [high bit #, low bit #] 
    static DecodeBitValue(opcode, range) {
      const mask = (1 << (range[0] - range[1] + 1)) - 1;
      const value = (opcode >>> range[1]) & mask 
      return value;
    }

}

  module.exports=[BitFields, BitSet, BitClear];