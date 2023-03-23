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



/*
 *  This class allows for the changing for core modes and associate the correct register to the correct bank according to the provided registerBankMap.
 *  In it's implementation it depends on each bank having the array size for all registers, even though  it may not hold them.
 *  Use the bank.map to indicate which registers are active from the bank. Se the ARM32 RegisterBankMap for example.
 * 
 *  The first entry in the registryMap will be default loaded and should have all registers mapped.
 */
var count=0;
class CoreContext {
    constructor(registerBankMap) {
      this.registerBankMap = registerBankMap;
      this.registers = [];
      this.numRegisters=0;

      // Set the initial mode and map all registers, this is the first entry
      if (!registerBankMap) {
        throw("Register Bank Required");
      }
      this.setMode(this.registerBankMap[0].mode);
    }
  
    setMode(mode) {
      let activeBank;
  
      // Find the active bank based on the mode
      for (const bank of this.registerBankMap) {
        if ((mode & bank.mode) === mode) {
          activeBank = bank;
          break;
        }
      }

      this.numRegisters=activeBank.map.length;
  
      // Map registers by assigning the active bank
      for (let i = 0; i < activeBank.map.length; i++) {
        if (activeBank.map[i]) {
          this.registers[i] = activeBank.bank;
        }
      }
    }
  
    getRegister(idx) {
        if (!this.registers[idx]) throw("Register "+idx+" not associated with any bank");
        return this.registers[idx][idx];
    }

    setRegister(idx,value) {
        if (!this.registers[idx]) throw("Register "+idx+" not associated with any bank");
        this.registers[idx][idx]=value;
    }
  }


class CoreBase {
    constructor (name, platform, memory, registerBankMap) {
        this.name=name;
        this.active = false;    
        this.platform = platform;
        this.opcodes = platform.opcodes;
        this.memory=memory;


        // Register Banks
        this.context = new CoreContext(registerBankMap);

    }

    setContext(mode) {
        this.context.setMode(mode);
    }

    getRegister(idx)        { return this.context.getRegister(idx); }
    setRegister(idx, value) { this.context.setRegister(idx,value);  }

}

module.exports=CoreBase;