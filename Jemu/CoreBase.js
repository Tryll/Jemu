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


class CoreBase {
    constructor (name, platform, memory) {
        this.name=name;
        this.active = false;    
        this.platform = platform;
        this.opcodes = platform.opcodes;
        this.memory=memory;
    }

    mapRegisters(RegisterMap) {
        CoreBase.MapRegisters(this, RegisterMap);
    }

    static MapRegisters(obj, RegisterMap) {

        if (!obj.regs) throw ("CoreBase: regs must be defined before mapping of registers to properties can be done");

        // Registers: getters and setters
        // (class instance).SP get and set into this.regs automatically
        for (let i = 0; i < Object.keys(RegisterMap).length; i++) {
            Object.defineProperty(obj,Object.keys(RegisterMap)[i], {get() { return obj.regs[i];}, set(value) {obj.regs[i] = value;}});
        }
    }

    
}

module.exports=CoreBase;