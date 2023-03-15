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