

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