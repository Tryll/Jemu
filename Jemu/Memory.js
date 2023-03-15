const fs = require("fs");

class Memory {
    constructor(size, endianness) {
      this.buffer = new ArrayBuffer(size);
      this.dataView = new DataView(this.buffer);
      this.littleEndian = (endianness == 'little-endian');
    }
  
    readByte(address) {
      return this.dataView.getUint8(address);
    }
  
    writeByte(address, value) {
      this.dataView.setUint8(address, value);
    }
  
    readWord(address) {
      return this.dataView.getUint16(address, this.littleEndian);
    }
  
    writeWord(address, value) {
      this.dataView.setUint16(address, value, this.littleEndian);
    }
  
    readDword(address) {
      return this.dataView.getUint32(address, this.littleEndian);
    }

    writeDword(address, value) {
      this.dataView.setUint32(address, value, this.littleEndian);
    }
  
    readQword(address) {
      const highBits = this.dataView.getBigUint64(address, this.littleEndian);
      const lowBits = this.dataView.getBigUint64(address + 8, this.littleEndian);
      return (highBits << BigInt(64)) + lowBits;
    }
  
    writeQword(address, value) {
      this.dataView.setBigUint64(address, value >> BigInt(64), this.littleEndian);
      this.dataView.setBigUint64(address + 8, value & BigInt(0xffffffffffffffff), this.littleEndian);
    }

    readBytes(address, length) {
      return new Uint8Array(this.buffer, address, length);
    }

    writeBytes(address, buffer) {
      const src = new Uint8Array(buffer);
      const dst = new Uint8Array(this.buffer, address, buffer.length);
      dst.set(src);
    }

    loadFile(address, filename) {
      const data = fs.readFileSync(filename);
      const buffer = new Uint8Array(data);
  
      for (let i = 0; i < buffer.length; i++) {
        this.writeByte(address + i, buffer[i]);
      }
    }
}

module.exports=Memory;