const ARMv0 = require("./armv0.js");
const ARM32 = require("./arm32.js");

var ARMv7l = ARMv0;
ARMv7l.name="ARMv7l";

module.exports = [ARM32, ARMv7l];