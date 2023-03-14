const Memory = require("./Memory.js");

class MMU {
    constructor(memoryMap, endianness) {
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
        throw new Error(`No segment found for address: 0x${address.toString(16)}`);
    }



    readByte(address) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r'))  {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }

        return segment.memory.readByte(address - segment.start);
    }

    writeByte(address, value) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.writeByte(address - segment.start, value);
    }

    readWord(address) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r')) {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }
        return segment.memory.readWord(address - segment.start);
    }

    writeWord(address, value) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.writeWord(address - segment.start, value);
    }

    readDword(address) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r')) {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }

        return segment.memory.readDword(address - segment.start);
    }


    writeDword(address, value) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.writeDword(address - segment.start, value);
    }


    readBytes(address, length) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('r')) {
            throw new Error(`No read permission for address: 0x${address.toString(16)}`);
        }

        return segment.memory.readBytes(address - segment.start, length);
    }


    writeBytes(address, buffer) {
        const segment = this.getSegment(address);
        if (!segment.permissions.includes('w')) {
            throw new Error(`No write permission for address: 0x${address.toString(16)}`);
        }

        segment.memory.readBytes(address - segment.start, buffer);
    }
}

module.exports = MMU;