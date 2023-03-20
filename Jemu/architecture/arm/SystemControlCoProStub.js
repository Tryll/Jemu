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

class SystemControlCoprocessor extends CoreBase {
    static RegisterMap = {
      "ID_PFR0": 0, "ID_PFR1": 1,"ID_DFR0": 2,"ID_AFR0": 3, "ID_MMFR0": 4,      "ID_MMFR1": 5,
      "ID_MMFR2": 6, "ID_MMFR3": 7, "ID_ISAR0": 8, "ID_ISAR1": 9, "ID_ISAR2": 10, "ID_ISAR3": 11,
      "ID_ISAR4": 12, "ID_ISAR5": 13, "SCTLR": 14, "ACTLR": 15, "CPACR": 16,
      "C1": 17,"C2": 18,"C3": 19,"C3": 20, "C4": 21, "C5": 22, "C6": 23, "C7": 24, "C8": 25,
      "C9": 26, "C10": 27, "C11": 28, "C12": 29, "C13": 30, "C14": 31,
      "C15": 32
    };
  
    constructor(core, mmu) {
      super (core.name+"_SysCoProc", {}, mmu, SystemControlCoprocessor.RegisterMap);
      this.core=core;
    }
  
    handle(core, memory, opcode, decoded){
        console.log ("SystemControlCoProcessor CP15.Handle("+JSON.stringify(decoded)+")");
    }
    // Methods to read and write registers, handle specific operations, etc.
  }


  module.exports=[SystemControlCoprocessor];