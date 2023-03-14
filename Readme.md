

PS C:\Repos\Jemu> node .\Jemu.js
GDB server listening on port 2456
Client connected
0x00000000 : 0xea00000e as 'b #imm24' with {"cond":14,"imm24":14}
0x00000040 : 0xe24f0048 as 'add<c> <Rd>, PC, #<const>' with {"rd":0,"imm12":72,"isSub":true}
0x00000044 : 0xe59f12c4 as 'ldr<c> <Rt> [<Rn> {#+/-<imm12>}]' with {"rSrc":15,"rDst":1,"imm12":708}
0x00000048 : 0xe1500001 as 'cmp<c> <Rn>, <Rm> {,<shift>}' with {"rn":0,"rm":1,"shift_t":0,"shift_n":0}

Goals:
 1. Multhreaded
 2. Minimalistic device tree
 3. Clocks / Timing

Would be nice if:
 1. Was a  npm package at some point
 2. Could be used by reference in a device specific source tree, ie. rapid device emulation development

 Pros:
 Greatest pro: No silly compile environment crazyness and source structure problems, like with Qemu and others.



