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

const Memory = require("./Memory.js");

class MMU {
    constructor(machine,  memoryMap, endianness) {
        this.machine=machine;
        this.memoryMap=memoryMap;
        this.segments = [];
        for (let i = 0; i < memoryMap.length; i++) {
            const segment = memoryMap[i];
            this.segments.push({
                name: segment.name,
                start: segment.start,
                end: segment.end,
                memory: new Memory(segment.end - segment.start, endianness),
                permissions: segment.permissions
            });
        }
    }


    loadFile(regionName, filename) {
        const region = this.memoryMap.find(r => r.name === regionName);
        if (!region) {
          throw new Error(`Region "${regionName}" not found`);
        }
    
        const segment = this.segments[this.memoryMap.indexOf(region)];
        segment.loadFile(0, filename);
      }
    
    loadFileToAddress(address, filename) {
        let segment = null;
        for (let i = 0; i < this.segments.length; i++) {
            const region = this.memoryMap[i];
            if (address >= region.start && address < region.end) {
            segment = this.segments[i];
            break;
            }
        }

        if (segment==null) {
            throw new Error(`No segment found for address: 0x${address.toString(16)}`);
        }

        segment.memory.loadFile(0,filename);
    }


    getSegment(address) {
        for (let name in this.segments) {
            const segment = this.segments[name];
            if (address >= segment.start && address <= segment.end) {
                return segment;
            }
        }
        throw new Error(`No segment found for address: 0x${ (address) ?address.toString(16) : 'NaN' } `);
    }

    doBreakPointCheck(address) {
        if (this.machine.state == 'run') {
            for (var bpId in this.machine.BreakPoints) {
                var bp =this.machine.BreakPoints[bpId];
                if (bp.address == address) {
                    throw({breakpoint:bp});
                }
            }
        }
    }


    readByte(address) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r'))  {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }

        return segment.memory.readByte(address - segment.start);
    }

    writeByte(address, value) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.writeByte(address - segment.start, value);
    }

    readUint16(address) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r')) {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }
        return segment.memory.readUint16(address - segment.start);
    }

    writeUint16(address, value) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.writeUint16(address - segment.start, value);
    }

    readUint32(address) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r')) {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }

        return segment.memory.readUint32(address - segment.start);
    }


    writeUint32(address, value) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.writeUint32(address - segment.start, value);
    }


    readBytes(address, length) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r')) {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }

        return segment.memory.readBytes(address - segment.start, length);
    }


    writeBytes(address, buffer) {
        this.doBreakPointCheck(address);

        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.readBytes(address - segment.start, buffer);
    }
}

module.exports = MMU;