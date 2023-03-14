
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

    // Parses a value based on the provided bitFieldMap and return an object with the values.
    // example decoder: {rd: [15, 12], imm12: [11,0], isSub:[23, 20, 4]}
    // isSub =  the value of the bitrange 23-20 compared to 4
    //
    static Parse(value, bitFieldMap) {
      var decoded={};
      for (var name in bitFieldMap){
        var decoderDef=bitFieldMap[name];
        decoded[name]=BitFields.DecodeBitValue(value, decoderDef);
        if (decoderDef.length==3) {
          decoded[name]=decoded[name]==decoderDef[2];
        }
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