In basic development, look-but-dont-touch :)

Goals:
 1. Multihreaded
 2. Minimalistic device tree
 3. Clocks / Timing

Would be nice if:
 1. Was a  npm package at some point
 2. Could be used by reference in a device specific source tree, ie. rapid device emulation development

 Greatest pro: No silly compile environment crazyness and source structure problems, like with Qemu and others.

```
PS C:\Repos\Jemu> node .\Example.js
GDB server listening on port 2456
GDB: Client connected
0x00000000 : 0xea00000e as 'b #imm24' with {"cond":14,"imm24":14}
0x00000040 : 0xe24f0048 as 'add<c> <Rd>, PC, #<const>' with {"rd":0,"imm12":72,"isSub":true}
0x00000044 : 0xe59f12c4 as 'ldr<c> <Rt> [<Rn> {#+/-<imm12>}]' with {"rSrc":15,"rDst":1,"imm12":708}
0x00000048 : 0xe1500001 as 'cmp<c> <Rn>, <Rm> {,<shift>}' with {"rn":0,"rm":1,"shift_t":0,"shift_n":0}
0x0000004c : 0xeb0013db as 'bl <label>' with {"cond":14,"s":0,"imm24":5083}
0x00004fc0 : 0xe3a024ff as 'mov{s}<c> <Rd>, #<const>' with {"rd":2,"imm12":1279,"S":0}
0x00004fc4 : 0xe382280f as 'orr{s}<c> <Rd>, <Rn>, #<const>' with {"cond":14,"rd":2,"rn":2,"imm12":2063,"S":0}
0x00004fc8 : 0xe3822002 as 'orr{s}<c> <Rd>, <Rn>, #<const>' with {"cond":14,"rd":2,"rn":2,"imm12":2,"S":0}
0x00004fcc : 0xee2f2f12 as 'mcr<c> <coproc>, <opcode_1>, <Rt>, <CRn>, <CRm>, <opcode_2>' with {"cond":14,"opcode_1":1,"crn":15,"rt":2,"cp_num":15,"opcode_2":1,"crm":2}
SystemControlCoProcessor CP15.Handle({"cond":14,"opcode_1":1,"crn":15,"rt":2,"cp_num":15,"opcode_2":1,"crm":2})
0x00004fd0 : 0xf57ff06f as 'ISB SY' with {}
0x00004fd4 : 0xe12fff1e as 'BX LR' with {"Rm":14}
0x00000050 : 0xe1500001 as 'cmp<c> <Rn>, <Rm> {,<shift>}' with {"rn":0,"rm":1,"shift_t":0,"shift_n":0}
0x00000054 : 0xa000007 as 'b #imm24' with {"cond":0,"imm24":7}
0x00000078 : 0xe1a0000f as 'mov<c> <Rd>, PC' with {"rd":0}
0x0000007c : 0xe59f1294 as 'ldr<c> <Rt> [<Rn> {#+/-<imm12>}]' with {"rSrc":15,"rDst":1,"imm12":660}
0x00000080 : 0xe0400001 as 'sub<c> <Rd>, <Rn>, <Rm>' with {"rd":0,"rn":0,"rm":1}
GDB: Client disconnected
```



