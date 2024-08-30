import { CGB } from "./cgb";

const NIBBLE_MASK = 0xf;
const BYTE_MASK = 0xff;
const TWELVE_BIT_BASK = 0xfff;
const SHORT_MASK = 0xffff;
const ZERO_MASK = 0x80;
const SUBTRACT_MASK = 0x40;
const HALF_CARRY_MASK = 0x20;
const CARRY_MASK = 0x10;
const BLOCK_MASK = 0x03;
const REG_8_MASK = 0x07;
const REG_16_MASK = 0x3;
const SIGN_MASK = 0x80;

export const BYTE_SHIFT = 8;
const ZERO_SHIFT = 7;
const SUBTRACT_SHIFT = 6;
const HALF_CARRY_SHIFT = 5;
const CARRY_SHIFT = 4;
const BLOCK_SHIFT = 6;
export const REG_8_SHIFT = 3;
export const REG_16_SHIFT = 4;

export const A_INDEX = 7;
export const B_INDEX = 0;
export const C_INDEX = 1;
export const D_INDEX = 2;
export const E_INDEX = 3;
export const H_INDEX = 4;
export const L_INDEX = 5;
export const MEM_AT_HL_INDEX = 6;

export const BC_INDEX = 0;
export const DE_INDEX = 1;
export const HL_HLI_INDEX = 2;
export const SP_AF_HLD_INDEX = 3;

interface OpcodeBlock {
  opcodeToOp?: Map<number, () => void>;
  nibbleToOp?: Map<number, (r16: number) => void>;
  r8ToOp?: Map<number, (r8Prime: number) => void>;
  r8PrimeToOp?: Map<number, (r8: number) => void>;
  r8r8PrimeOp?: (r8: number, r8Prime: number) => void;
}

export enum RegIndexType {
  Normal,
  Stack,
  Memory,
}

function hiByte(value: number) {
  return (value >> BYTE_SHIFT) & BYTE_MASK;
}

function loByte(value: number) {
  return value & BYTE_MASK;
}

function hiLoBytesToShort(hi: number, lo: number): number {
  return (hi << BYTE_SHIFT) | lo;
}

export class CPU {
  cgb: CGB;

  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  H: number;
  L: number;

  SP: number;
  PC: number;

  zero: boolean;
  subtract: boolean;
  halfCarry: boolean;
  carry: boolean;

  cycles: number;

  constructor(cgb: CGB) {
    this.cgb = cgb;

    this.A = 0;
    this.B = 0;
    this.C = 0;
    this.D = 0;
    this.E = 0;
    this.H = 0;
    this.L = 0;
    this.SP = 0;
    this.PC = 0;

    this.zero = false;
    this.subtract = false;
    this.halfCarry = false;
    this.carry = false;

    this.cycles = 0;
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Fetch + Decode
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  BLOCKS = new Map<number, () => OpcodeBlock>([
    [0b00, () => this.BLOCK_0],
    [0b01, () => this.BLOCK_1],
    [0b10, () => this.BLOCK_2],
    [0b11, () => this.BLOCK_3],
  ]);

  step(): number {
    this.cycles = 0;
    const opcode = this.cgb.mmu.imm8();
    const blockIndex = (opcode >> BLOCK_SHIFT) & BLOCK_MASK;
    const block =
      opcode === 0xcb ? this.BLOCK_CB : this.BLOCKS.get(blockIndex)!();
    this.handleOpcodeBlock(opcode, block);
    return this.cycles;
  }

  handleOpcodeBlock(opcode: number, block: OpcodeBlock) {
    if (block.opcodeToOp !== undefined) {
      if (block.opcodeToOp.has(opcode)) {
        block.opcodeToOp.get(opcode)!.call(this);
        return;
      }
    }

    if (block.nibbleToOp !== undefined) {
      const r16 = (opcode >> REG_16_SHIFT) & REG_16_MASK;
      const nibble = opcode & NIBBLE_MASK;
      if (block.nibbleToOp.has(nibble)) {
        block.nibbleToOp.get(nibble)!.call(this, r16);
        return;
      }
    }

    const r8 = (opcode >> REG_8_SHIFT) & REG_8_MASK;
    const r8Prime = opcode & REG_8_MASK;

    if (block.r8ToOp !== undefined) {
      if (block.r8ToOp.has(r8)) {
        block.r8ToOp.get(r8)!.call(this, r8Prime);
        return;
      }
    }

    if (block.r8PrimeToOp !== undefined) {
      if (block.r8PrimeToOp.has(r8Prime)) {
        block.r8PrimeToOp.get(r8Prime)!.call(this, r8);
        return;
      }
    }

    if (block.r8r8PrimeOp !== undefined) {
      block.r8r8PrimeOp!.call(this, r8, r8Prime);
      return;
    }

    console.log(`Invalid opcode: ${opcode.toString(16)}`);
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Instruction Block 0
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  BLOCK_0: OpcodeBlock = {
    opcodeToOp: new Map<number, () => void>([
      [0x00, CPU.prototype.nop],
      [0x08, CPU.prototype.ldMemAtImm16SP],
    ]),
    nibbleToOp: new Map<number, (r16: number) => void>([
      [0b1010, CPU.prototype.ldRegAMemAtReg16],
      [0b0010, CPU.prototype.ldMemAtReg16RegA],
      [0b0001, CPU.prototype.ldReg16Imm16],
    ]),
    r8PrimeToOp: new Map<number, (r8: number) => void>([
      [0b110, CPU.prototype.ldReg8Imm8],
    ]),
  };

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Instruction Block 1
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  BLOCK_1: OpcodeBlock = {
    opcodeToOp: new Map<number, () => void>([
      [0x76, () => {}], // TODO: implement halt
    ]),
    r8r8PrimeOp: CPU.prototype.ldReg8Reg8,
  };

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Instruction Block 2
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  BLOCK_2: OpcodeBlock = {
    r8ToOp: new Map<number, (r8Prime: number) => void>([
      [0b000, CPU.prototype.addRegAReg8],
      [0b001, CPU.prototype.adcRegAReg8],
      [0b010, CPU.prototype.subRegAReg8],
      [0b011, CPU.prototype.sbcRegAReg8],
      [0b100, CPU.prototype.andRegAReg8],
      [0b111, CPU.prototype.cpRegAReg8],
    ]),
  };

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Instruction Block 3
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  BLOCK_3: OpcodeBlock = {
    opcodeToOp: new Map<number, () => void>([
      [0xc6, CPU.prototype.addRegAImm8],
      [0xce, CPU.prototype.adcRegAImm8],
      [0xd6, CPU.prototype.subRegAImm8],
      [0xde, CPU.prototype.sbcRegAImm8],
      [0xe0, CPU.prototype.ldMemAtImm8RegA],
      [0xf0, CPU.prototype.ldRegAMemAtImm8],
      [0xe2, CPU.prototype.ldMemAtRegCRegA],
      [0xf2, CPU.prototype.ldRegAMemAtRegC],
      [0xe2, CPU.prototype.ldMemAtRegCRegA],
      [0xf8, CPU.prototype.ldhlSPAddImm8],
      [0xf9, CPU.prototype.ldSPRegHL],
      [0xea, CPU.prototype.ldMemAtImm16RegA],
      [0xfa, CPU.prototype.ldRegAMemAtImm16],
      [0xfe, CPU.prototype.cpRegAImm8],
    ]),
    nibbleToOp: new Map<number, (r16: number) => void>([
      [0b0101, CPU.prototype.push],
      [0b0001, CPU.prototype.pop],
    ]),
  };

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // CB Prefixed Instruction Block
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  BLOCK_CB: OpcodeBlock = {};

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Instructions
  // NOTE: flag order = C H N Z
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // 8-Bit Transfer + Input/Output Instructions
  // **** verified ****
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // ld r8, r8'
  // load register r8' into register r8
  // opcode: 01 r8 r8'
  // flags: - - - -
  // cycles: 1 or 2
  ldReg8Reg8(r8: number, r8Prime: number) {
    this.setReg8(r8, this.getReg8(r8Prime));
  }

  // ld r8, imm8
  // load 8-bit immediate imm8 into register r8
  // opcode: 00 r8 110
  // flags: - - - -
  // cycles: 2 or 3
  ldReg8Imm8(r8: number) {
    this.setReg8(r8, this.cgb.mmu.imm8());
  }

  // ld a, [r16]
  // load memory at register pair r16 into register a
  // opcode: 00 r16 1010
  // flags: - - - -
  // cycles: 2
  ldRegAMemAtReg16(r16: number) {
    this.A = this.cgb.mmu.read(this.getReg16(r16, RegIndexType.Memory));
  }

  // ld [r16], a
  // load register a into memory at register pair dd
  // opcode: 00 r16 0010
  // flags: - - - -
  // cycles: 2
  ldMemAtReg16RegA(r16: number) {
    this.cgb.mmu.write(this.getReg16(r16, RegIndexType.Memory), this.A);
  }

  // ld a, [c]
  // load memory at ff00 + register c into register a
  // opcode: 11 110 010
  // flags: - - - -
  // cycles: 2
  ldRegAMemAtRegC() {
    this.A = this.cgb.mmu.read(0xff00 + this.C);
  }

  // ld [c], a
  // load register a into memory at ff00 + register c
  // opcode: 11 100 010
  // flags: - - - -
  // cycles: 2
  ldMemAtRegCRegA() {
    this.cgb.mmu.write(0xff00 + this.C, this.A);
  }

  // ld a, [imm8]
  // load memory at ff00 + 8-bit immediate imm8 into register a
  // opcode: 11 110 000
  // flags: - - - -
  // cycles: 3
  ldRegAMemAtImm8() {
    this.A = this.cgb.mmu.read(0xff00 + this.cgb.mmu.imm8());
  }

  // ld [imm8], a
  // load register a into memory at ff00 + 8-bit immediate imm8
  // opcode: 11 100 000
  // flags: - - - -
  // cycles: 3
  ldMemAtImm8RegA() {
    this.cgb.mmu.write(0xff00 + this.cgb.mmu.imm8(), this.A);
  }

  // ld a, [imm16]
  // load memory at 16-bit immediate imm16 into register a
  // opcode: 11 111 010
  // flags: - - - -
  // cycles: 4
  ldRegAMemAtImm16() {
    this.A = this.cgb.mmu.read(this.cgb.mmu.imm16());
  }

  // ld [imm16], a
  // load register a into memory at 16-bit immediate imm16
  // opcode: 11 101 010
  // flags: - - - -
  // cycles: 4
  ldMemAtImm16RegA() {
    this.cgb.mmu.write(this.cgb.mmu.imm16(), this.A);
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // 16-Bit Transfer Instructions
  // **** verified ****
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // ld r16, imm16
  // load 16-bit immediate imm16 into register pair r16
  // opcode: 00 r16 0001
  // flags: - - - -
  // cycles: 3
  ldReg16Imm16(r16: number) {
    this.setReg16(r16, this.cgb.mmu.imm16(), RegIndexType.Normal);
  }

  // ld sp, hl
  // load register pair hl into stack pointer sp
  // opcode: 11 111 001
  // flags: - - - -
  // cycles: 2
  ldSPRegHL() {
    this.SP = this.getHL();
    this.cycles++;
  }

  // ldhl sp, imm8
  // load sp + signed 8-bit immediate imm8 into register pair hl
  // opcode: 11 111 000
  // flags: C H 0 0
  // cycles: 3
  ldhlSPAddImm8() {
    this.setHL(this._addSPImm8());
    this.cycles++;
  }

  // ld [imm16], sp
  // load stack pointer sp into memory at 16-bit immediate imm16
  // opcode: 00 001 000
  // flags: - - - -
  // cycles: 5
  ldMemAtImm16SP() {
    const addr = this.cgb.mmu.imm16();
    this.cgb.mmu.write(addr, loByte(this.SP));
    this.cgb.mmu.write(addr + 1, hiByte(this.SP));
  }

  // push r16
  // push register pair r16 onto stack
  // opcode: 11 r16 0101
  // flags: - - - -
  // cycles: 4
  push(r16: number) {
    const r16Val = this.getReg16(r16, RegIndexType.Stack);
    this.cgb.mmu.write(--this.SP, hiByte(r16Val));
    this.cgb.mmu.write(--this.SP, loByte(r16Val));
    this.cycles++;
  }

  // pop r16
  // pop stack into register pair r16
  // opcode: 11 r16 0001
  // flags: - - - -
  // cycles: 3
  pop(r16: number) {
    const lo = this.cgb.mmu.read(this.SP++);
    const hi = this.cgb.mmu.read(this.SP++);
    this.setReg16(r16, hiLoBytesToShort(hi, lo), RegIndexType.Stack);
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // 8-Bit Arithmetic and Logical Operation Instructions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // add a, r8
  // adds register r8 to register a
  // opcode: 10 000 r8
  // flags: C H 0 Z
  // cycles: 1 or 2
  // **** verified ****
  addRegAReg8(r8: number) {
    this.A = this.add(this.A, this.getReg8(r8));
  }

  // add a, imm8
  // adds immediate imm8 to register a
  // opcode: 11 000 110
  // flags: C H 0 Z
  // cycles: 2
  // **** verified ****
  addRegAImm8() {
    this.A = this.add(this.A, this.cgb.mmu.imm8());
  }

  // adc a, r8
  // adds register r8 and carry to register a
  // opcode: 10 001 r8
  // flags: C H 0 Z
  // cycles: 1 or 2
  // **** verified ****
  adcRegAReg8(r8: number) {
    this.A = this.add(this.A, this.getReg8(r8), true);
  }

  // adc a, imm8
  // adds immediate imm8 and carry to register a
  // opcode: 11 001 110
  // flags: C H 0 Z
  // cycles: 2
  // **** verified ****
  adcRegAImm8() {
    this.A = this.add(this.A, this.cgb.mmu.imm8(), true);
  }

  // sub a, r8
  // subtracts register r8 from register a
  // opcode: 10 010 r8
  // flags: C H 1 Z
  // cycles: 1 or 2
  // **** verified ****
  subRegAReg8(r8: number) {
    this.A = this.sub(this.A, this.getReg8(r8));
  }

  // sub a, imm8
  // subtracts immediate imm8 from register a
  // opcode: 11 010 110
  // flags: C H 1 Z
  // cycles: 2
  // **** verified ****
  subRegAImm8() {
    this.A = this.sub(this.A, this.cgb.mmu.imm8());
  }

  // sbc a, r8
  // subtracts register r8 and carry from register a
  // opcode: 10 011 r8
  // flags: C H 1 Z
  // cycles: 1 or 2
  // **** verified ****
  sbcRegAReg8(r8: number) {
    this.A = this.sub(this.A, this.getReg8(r8), true);
  }

  // sbc a, imm8
  // subtracts immediate imm8 and carry from register a
  // opcode: 11 011 110
  // flags: C H 1 Z
  // cycles: 2
  // **** verified ****
  sbcRegAImm8() {
    this.A = this.sub(this.A, this.cgb.mmu.imm8(), true);
  }

  // cp a, r8
  // compare register a to register r8
  // opcode: 10 111 r8
  // flags: C H 1 Z
  // cycles: 1 or 2
  // **** verified ****
  cpRegAReg8(r8: number) {
    this.sub(this.A, this.getReg8(r8));
  }

  // cp a, imm8
  // compare immediate imm8 to register r8
  // opcode: 11 111 110
  // flags: C H 1 Z
  // cycles: 2
  // **** verified ****
  cpRegAImm8() {
    this.sub(this.A, this.cgb.mmu.imm8());
  }

  // and a, r8
  // ands register r8 with register a
  // opcode: 10 100 r8
  // flags: 0 1 0 Z
  // cycles: 1 or 2
  // **** verified ****
  andRegAReg8(r8: number) {
    this.and(this.getReg8(r8));
  }

  // and a, imm8
  // ands immediate imm8 with register a
  // opcode: 11 100 110
  // flags: 0 1 0 Z
  // cycles: 2
  // **** verified ****
  andRegAImm8() {
    this.and(this.cgb.mmu.imm8());
  }

  // or a, r8
  // ors register r8 with register a
  // opcode: 10 110 r8
  // flags: 0 0 0 Z
  // cycles: 1 or 2
  orRegAReg8(r8: number) {
    this.or(this.getReg8(r8));
  }

  // or a, imm8
  // ors immediate imm8 with register a
  // opcode: 11 110 110
  // flags: 0 0 0 Z
  // cycles: 2
  orRegAImm8() {
    this.or(this.cgb.mmu.imm8());
  }

  // xor a, r8
  // xors register r8 with register a
  // opcode: 10 101 r8
  // flags: 0 0 0 Z
  // cycles: 1 or 2
  xorRegAReg8(r8: number) {
    this.xor(this.getReg8(r8));
  }

  // xor a, imm8
  // xors immediate imm8 with register a
  // opcode: 11 101 110
  // flags: 0 0 0 Z
  // cycles: 2
  xorRegAImm8() {
    this.xor(this.cgb.mmu.imm8());
  }

  // inc r8
  // increment register r8
  // opcode: 00 r8 100
  // flags: - H 0 Z
  // cycles: 1 or 3
  incReg8(r8: number) {
    this.incDec(r8, true);
  }

  // dec r8
  // decrement register r8
  // opcode: 00 r8 101
  // flags: - H 1 Z
  // cycles: 1 or 3
  decReg8(r8: number) {
    this.incDec(r8, false);
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // 16-Bit Arithmetic Operation Instructions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // add hl, r16
  // add register pair r16 to register pair hl
  // opcode: 00 r16 1001
  // flags: C H 0 -
  // cycles: 2
  addRegHLReg16(r16: number) {
    const hl = this.getHL();
    const r16Value = this.getReg16(r16);
    const result = hl + r16Value;
    const twelveBitResult =
      (hl & TWELVE_BIT_BASK) + (r16Value & TWELVE_BIT_BASK);
    this.carry = result > SHORT_MASK;
    this.halfCarry = twelveBitResult > TWELVE_BIT_BASK;
    this.subtract = false;
    this.setHL(result & SHORT_MASK);
    this.cycles++;
  }

  // add SP, imm8
  // add 8-bit immediate imm8 to stack pointer sp
  // opcode: 11 101 000
  // flags: C H 0 -
  // cycles: 4
  addSPImm8() {
    this.SP = this._addSPImm8();
    this.cycles += 2;
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Rotate Shift Instructions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Bit Operations
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Jump Instructions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Call and Return Instructions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // General-Purpose Arithmetic Operations and CPU Control Instructions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // nop
  // no operation
  // opcode: 00 000 000
  // flags: - - - -
  // cycles: 1
  nop() {}

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Helper Functions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  add(a: number, b: number, withCarry: boolean = false): number {
    const carry = withCarry && this.carry ? 1 : 0;
    const result = a + b + carry;
    const halfResult = (a & NIBBLE_MASK) + (b & NIBBLE_MASK) + carry;
    this.carry = result > BYTE_MASK;
    this.halfCarry = halfResult > NIBBLE_MASK;
    this.subtract = false;
    this.zero = result === 0;
    return result & BYTE_MASK;
  }

  _addSPImm8(): number {
    let imm8 = this.cgb.mmu.imm8();
    this.add(this.SP & BYTE_MASK, imm8);
    const imm8IsNegative = (imm8 & SIGN_MASK) === 1;
    if (imm8IsNegative) imm8 |= BYTE_MASK << BYTE_SHIFT;
    this.zero = false;
    return (this.SP + imm8) & SHORT_MASK;
  }

  sub(a: number, b: number, withCarry: boolean = false): number {
    const carry = withCarry && this.carry ? 1 : 0;
    const result = a - b - carry;
    const halfA = a & NIBBLE_MASK;
    const halfB = b & NIBBLE_MASK;
    this.carry = a < b + carry;
    this.halfCarry = halfA < halfB + carry;
    this.subtract = true;
    this.zero = result === 0;
    return result & BYTE_MASK;
  }

  and(value: number) {
    this.A &= value;
    this.carry = false;
    this.halfCarry = true;
    this.subtract = false;
    this.zero = this.A === 0;
  }

  or(value: number) {
    this.A |= value;
    this.carry = false;
    this.halfCarry = false;
    this.subtract = false;
    this.zero = this.A === 0;
  }

  xor(value: number) {
    this.A ^= value;
    this.carry = false;
    this.halfCarry = false;
    this.subtract = false;
    this.zero = this.A === 0;
  }

  incDec(r8: number, increment: boolean) {
    const tempCarry = this.carry;
    const r8Value = this.getReg8(r8);
    this.setReg8(r8, increment ? this.add(r8Value, 1) : this.sub(r8Value, 1));
    this.carry = tempCarry;
    if (r8 === MEM_AT_HL_INDEX) this.cycles++;
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Register Functions
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Indexed Getters
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  getReg8(index: number): number {
    switch (index) {
      case A_INDEX:
        return this.A;
      case B_INDEX:
        return this.B;
      case C_INDEX:
        return this.C;
      case D_INDEX:
        return this.D;
      case E_INDEX:
        return this.E;
      case H_INDEX:
        return this.H;
      case L_INDEX:
        return this.L;
      case MEM_AT_HL_INDEX:
        return this.cgb.mmu.read(this.getHL());
    }
    return 0;
  }

  getReg16(index: number, mode: RegIndexType = RegIndexType.Normal): number {
    switch (index) {
      case BC_INDEX:
        return this.getBC();
      case DE_INDEX:
        return this.getDE();
      case HL_HLI_INDEX:
        const hl = this.getHL();
        if (mode === RegIndexType.Memory) this.setHL(hl + 1);
        return hl;
      case SP_AF_HLD_INDEX:
        switch (mode) {
          case RegIndexType.Normal:
            return this.SP;
          case RegIndexType.Stack:
            return this.getAF();
          case RegIndexType.Memory:
            const hl = this.getHL();
            this.setHL(hl - 1);
            return hl;
        }
    }
    return 0;
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // Indexed Setters
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  setReg8(index: number, value: number) {
    switch (index) {
      case A_INDEX:
        this.A = value;
        break;
      case B_INDEX:
        this.B = value;
        break;
      case C_INDEX:
        this.C = value;
        break;
      case D_INDEX:
        this.D = value;
        break;
      case E_INDEX:
        this.E = value;
        break;
      case H_INDEX:
        this.H = value;
        break;
      case L_INDEX:
        this.L = value;
        break;
      case MEM_AT_HL_INDEX:
        this.cgb.mmu.write(this.getHL(), value);
        break;
    }
  }

  setReg16(index: number, value: number, mode: RegIndexType): number {
    switch (index) {
      case BC_INDEX:
        this.setBC(value);
        break;
      case DE_INDEX:
        this.setDE(value);
        break;
      case HL_HLI_INDEX:
        this.setHL(value);
        break;
      case SP_AF_HLD_INDEX:
        if (mode === RegIndexType.Stack) {
          this.setAF(value);
        } else {
          this.SP = value;
        }
    }
    return 0;
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // 16-Bit Getters
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  getAF(): number {
    let F = 0;
    if (this.zero) F |= ZERO_MASK;
    if (this.subtract) F |= SUBTRACT_MASK;
    if (this.halfCarry) F |= HALF_CARRY_MASK;
    if (this.carry) F |= CARRY_MASK;
    return (this.A << BYTE_SHIFT) | F;
  }

  getBC(): number {
    return (this.B << BYTE_SHIFT) | this.C;
  }

  getDE(): number {
    return (this.D << BYTE_SHIFT) | this.E;
  }

  getHL(): number {
    return (this.H << BYTE_SHIFT) | this.L;
  }

  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
  // 16-Bit Setters
  // :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

  setAF(value: number) {
    this.A = (value >> BYTE_SHIFT) & BYTE_MASK;
    this.zero = ((value >> ZERO_SHIFT) & 1) === 1;
    this.subtract = ((value >> SUBTRACT_SHIFT) & 1) === 1;
    this.halfCarry = ((value >> HALF_CARRY_SHIFT) & 1) === 1;
    this.carry = ((value >> CARRY_SHIFT) & 1) === 1;
  }

  setBC(value: number) {
    this.B = (value >> BYTE_SHIFT) & BYTE_MASK;
    this.C = value & BYTE_MASK;
  }

  setDE(value: number) {
    this.D = (value >> BYTE_SHIFT) & BYTE_MASK;
    this.E = value & BYTE_MASK;
  }

  setHL(value: number) {
    this.H = (value >> BYTE_SHIFT) & BYTE_MASK;
    this.L = value & BYTE_MASK;
  }
}
