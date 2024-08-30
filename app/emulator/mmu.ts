// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
// Memory Management Unit (MMU)
// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
// :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

import { CGB } from "./cgb";
import { BYTE_SHIFT } from "./cpu";

export const MMAP_SIZE = 0x10000;
export const MIN_ROM_SIZE = 0x8000;
export const MAX_ROM_SIZE = 0x800000;

export const ROM_BANK_0 = 0x0000;
export const ROM_BANK_1 = 0x4000;
export const VRAM = 0x8000;
export const EXT = 0xa000;
export const WRAM_BANK_0 = 0xc000;
export const WRAM_BANK_1 = 0xd000;
export const ECHO_BANK_0 = 0xe000;
export const ECHO_BANK_1 = 0xf000;
export const OAM = 0xfe00;
export const UNUSABLE = 0xfea0;
export const IO_REGS = 0xff00;
export const HRAM = 0xff80;

export const ROM_BANK_SIZE = 0x4000;
export const VRAM_SIZE = 0x2000;
export const EXT_SIZE = 0x2000;
export const WRAM_BANK_COUNT = 8;
export const WRAM_BANK_SIZE = 0x1000;
export const ECHO_BANK_0_SIZE = 0x1000;
export const ECHO_BANK_1_SIZE = 0x0e00;
export const OAM_SIZE = 0x00a0;
export const IO_REGS_SIZE = 0x0080;
export const HRAM_SIZE = 0x0080;

export const MMAP_SIZES = new Map<number, number>([
  [ROM_BANK_0, ROM_BANK_SIZE],
  [ROM_BANK_1, ROM_BANK_SIZE],
  [VRAM, VRAM_SIZE],
  [EXT, EXT_SIZE],
  [WRAM_BANK_0, WRAM_BANK_SIZE],
  [WRAM_BANK_1, WRAM_BANK_SIZE],
  [ECHO_BANK_0, ECHO_BANK_0_SIZE],
  [ECHO_BANK_1, ECHO_BANK_1_SIZE],
  [OAM, OAM_SIZE],
  [IO_REGS, IO_REGS_SIZE],
  [HRAM, HRAM_SIZE],
]);

type MMapEntry = {
  addr: number;
  bytes: Uint8Array;
};

function createBytes(size: number): Uint8Array {
  return new Uint8Array(size).fill(0);
}

function hex(value: number, digits: number): string {
  return value.toString(16).padStart(digits, "0");
}

export class MMU {
  cgb: CGB;

  mmap: MMapEntry[];

  rom: Uint8Array;
  vram: Uint8Array;
  extram: Uint8Array;
  wram: Uint8Array;
  oam: Uint8Array;
  ioregs: Uint8Array;
  hram: Uint8Array;

  constructor(cgb: CGB, romSize: number = MIN_ROM_SIZE) {
    this.cgb = cgb;

    this.mmap = new Array(MMAP_SIZE).fill(null);

    this.rom = createBytes(romSize);
    this.vram = createBytes(VRAM_SIZE);
    this.extram = createBytes(EXT_SIZE);
    this.wram = createBytes(WRAM_BANK_COUNT * WRAM_BANK_SIZE);
    this.oam = createBytes(OAM_SIZE);
    this.ioregs = createBytes(IO_REGS_SIZE);
    this.hram = createBytes(HRAM_SIZE);

    this.initMmap();
  }

  initMmap() {
    this.mapRomBank0(0);
    this.mapRomBank1(1);
    this.mapBytes(VRAM, this.vram);
    this.mapBytes(EXT, this.extram);
    this.mapWramBank0(0);
    this.mapWramBank1(1);
    this.mapBytes(OAM, this.oam);
    this.mapBytes(IO_REGS, this.ioregs);
    this.mapBytes(HRAM, this.hram);
  }

  mapRomBank0(bank: number) {
    this.mapBytes(ROM_BANK_0, this.rom, bank);
  }

  mapRomBank1(bank: number) {
    this.mapBytes(ROM_BANK_1, this.rom, bank);
  }

  mapWramBank0(bank: number) {
    this.mapBytes(WRAM_BANK_0, this.wram, bank);
    this.mapBytes(ECHO_BANK_0, this.wram, bank);
  }

  mapWramBank1(bank: number) {
    this.mapBytes(WRAM_BANK_1, this.wram, bank);
    this.mapBytes(ECHO_BANK_1, this.wram, bank);
  }

  mapBytes(mmapAddr: number, bytes: Uint8Array, bank: number = 0) {
    const size = MMAP_SIZES.get(mmapAddr)!;
    const bankSize = mmapAddr === ECHO_BANK_1 ? WRAM_BANK_SIZE : size;
    const bytesAddr = bank * bankSize;
    for (let i = 0; i < size; i++) {
      this.mmap[mmapAddr + i] = { addr: bytesAddr + i, bytes: bytes };
    }
  }

  readMmap(addr: number): number {
    const entry = this.mmap[addr];
    if (entry === null) {
      console.log(`readMmap: mmap entry is null @ addr=${hex(addr, 4)}`);
      return 0;
    }
    return entry.bytes[entry.addr];
  }

  writeMmap(addr: number, value: number) {
    const entry = this.mmap[addr];
    if (entry === null) {
      console.log(`writeMmap: mmap entry is null @ addr=${hex(addr, 4)}`);
      return;
    }
    entry.bytes[entry.addr] = value;
  }

  read(addr: number): number {
    this.cgb.cpu.cycles++;
    // TODO: intercept reads
    return this.readMmap(addr);
  }

  write(addr: number, value: number) {
    this.cgb.cpu.cycles++;
    // TODO: intercept writes
    this.writeMmap(addr, value);
  }

  imm8(): number {
    return this.read(this.cgb.cpu.PC++);
  }

  imm16(): number {
    const lo = this.read(this.cgb.cpu.PC++);
    const hi = this.read(this.cgb.cpu.PC++);
    return (hi << BYTE_SHIFT) | lo;
  }
}
