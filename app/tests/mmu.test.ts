import { describe, expect, it } from "vitest";
import {
  ECHO_BANK_0,
  ECHO_BANK_1,
  EXT,
  HRAM,
  IO_REGS,
  MAX_ROM_SIZE,
  MMAP_SIZE,
  MMAP_SIZES,
  MMU,
  OAM,
  ROM_BANK_0,
  ROM_BANK_1,
  UNUSABLE,
  VRAM,
  WRAM_BANK_0,
  WRAM_BANK_1,
  WRAM_BANK_SIZE,
} from "../emulator/mmu";
import { CGB } from "../emulator/cgb";

describe("mmu tests", () => {
  const mmu = newTestMmap();

  it("mmap null check", () => {
    for (let addr = 0; addr < MMAP_SIZE; addr++) {
      const entry = mmu.mmap[addr];
      const unusable = addr >= UNUSABLE && addr < IO_REGS;
      unusable ? expect(entry).to.be.null : expect(entry).to.be.not.null;
    }
  });

  it("mmap setup", () => {
    validateMmap(mmu);
  });

  it("rom banking", () => {
    mmu.mapRomBank0(2);
    mmu.mapRomBank1(3);

    writeMmapRange(mmu, ROM_BANK_0, 10);
    writeMmapRange(mmu, ROM_BANK_1, 11);

    checkMmapRange(mmu, ROM_BANK_0, 10, mmu.rom, 2);
    checkMmapRange(mmu, ROM_BANK_1, 11, mmu.rom, 3);

    mmu.mapRomBank0(0);
    mmu.mapRomBank1(1);

    validateMmap(mmu);
  });

  it("wram banking", () => {
    mmu.mapWramBank0(2);
    mmu.mapWramBank1(3);

    writeMmapRange(mmu, WRAM_BANK_0, 12);
    writeMmapRange(mmu, WRAM_BANK_1, 13);

    checkMmapRange(mmu, WRAM_BANK_0, 12, mmu.wram, 2);
    checkMmapRange(mmu, WRAM_BANK_1, 13, mmu.wram, 3);
    checkMmapRange(mmu, ECHO_BANK_0, 12, mmu.wram, 2);
    checkMmapRange(mmu, ECHO_BANK_1, 13, mmu.wram, 3);

    mmu.mapWramBank0(0);
    mmu.mapWramBank1(1);

    validateMmap(mmu);
  });
});

function newTestMmap(): MMU {
  const mmu = new MMU(new CGB(), MAX_ROM_SIZE);
  writeMmapRange(mmu, ROM_BANK_0, 1);
  writeMmapRange(mmu, ROM_BANK_1, 2);
  writeMmapRange(mmu, VRAM, 3);
  writeMmapRange(mmu, EXT, 4);
  writeMmapRange(mmu, WRAM_BANK_0, 5);
  writeMmapRange(mmu, WRAM_BANK_1, 6);
  writeMmapRange(mmu, OAM, 7);
  writeMmapRange(mmu, IO_REGS, 8);
  writeMmapRange(mmu, HRAM, 9);
  return mmu;
}

function validateMmap(mmu: MMU) {
  checkMmapRange(mmu, ROM_BANK_0, 1, mmu.rom, 0);
  checkMmapRange(mmu, ROM_BANK_1, 2, mmu.rom, 1);
  checkMmapRange(mmu, VRAM, 3, mmu.vram);
  checkMmapRange(mmu, EXT, 4, mmu.extram, 0);
  checkMmapRange(mmu, WRAM_BANK_0, 5, mmu.wram, 0);
  checkMmapRange(mmu, WRAM_BANK_1, 6, mmu.wram, 1);
  checkMmapRange(mmu, ECHO_BANK_0, 5, mmu.wram, 0);
  checkMmapRange(mmu, ECHO_BANK_1, 6, mmu.wram, 1);
  checkMmapRange(mmu, OAM, 7, mmu.oam);
  checkMmapRange(mmu, IO_REGS, 8, mmu.ioregs);
  checkMmapRange(mmu, HRAM, 9, mmu.hram);
}

function writeMmapRange(mmu: MMU, mmapAddr: number, value: number) {
  const size = MMAP_SIZES.get(mmapAddr)!;
  for (let i = 0; i < size; i++) {
    mmu.writeMmap(mmapAddr + i, value);
  }
}

function checkMmapRange(
  mmu: MMU,
  mmapAddr: number,
  value: number,
  bytes: Uint8Array,
  bank: number = 0
) {
  const size = MMAP_SIZES.get(mmapAddr)!;
  const bankSize = mmapAddr === ECHO_BANK_1 ? WRAM_BANK_SIZE : size;
  const bytesAddr = bank * bankSize;
  for (let i = 0; i < size; i++) {
    const mmapValue = mmu.readMmap(mmapAddr + i);
    const bytesValue = bytes[bytesAddr + i];
    expect(mmapValue).toEqual(bytesValue);
    expect(mmapValue).toEqual(value);
  }
}
