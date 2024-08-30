import { beforeEach, describe, expect, it } from "vitest";
import {
  A_INDEX,
  B_INDEX,
  BC_INDEX,
  C_INDEX,
  CPU,
  D_INDEX,
  DE_INDEX,
  E_INDEX,
  H_INDEX,
  HL_HLI_INDEX,
  L_INDEX,
  MEM_AT_HL_INDEX,
  REG_16_SHIFT,
  REG_8_SHIFT,
  RegIndexType,
  SP_AF_HLD_INDEX,
} from "../emulator/cpu";
import { CGB } from "../emulator/cgb";

describe("cpu tests", () => {
  let cgb = new CGB();
  let cpu = cgb.cpu;
  let mmu = cgb.mmu;

  beforeEach(() => {
    cgb = new CGB();
    cpu = cgb.cpu;
    mmu = cgb.mmu;
  });

  describe("register getters + setters tests", () => {
    it("16-bit register getters", () => {
      cpu.A = 0x01;
      cpu.zero = true;
      cpu.subtract = false;
      cpu.halfCarry = true;
      cpu.carry = false;

      cpu.B = 0x23;
      cpu.C = 0x45;
      cpu.D = 0x67;
      cpu.E = 0x89;
      cpu.H = 0xab;
      cpu.L = 0xcd;

      expect(cpu.getAF()).toEqual(0x01a0);
      expect(cpu.getBC()).toEqual(0x2345);
      expect(cpu.getDE()).toEqual(0x6789);
      expect(cpu.getHL()).toEqual(0xabcd);
    });

    it("16-bit register setters", () => {
      cpu.setAF(0xdc50);
      cpu.setBC(0xba98);
      cpu.setDE(0x7654);
      cpu.setHL(0x3210);

      expect(cpu.A).toEqual(0xdc);
      expect(cpu.zero).toBeFalsy();
      expect(cpu.subtract).toBeTruthy();
      expect(cpu.halfCarry).toBeFalsy();
      expect(cpu.carry).toBeTruthy();

      expect(cpu.B).toEqual(0xba);
      expect(cpu.C).toEqual(0x98);

      expect(cpu.D).toEqual(0x76);
      expect(cpu.E).toEqual(0x54);

      expect(cpu.H).toEqual(0x32);
      expect(cpu.L).toEqual(0x10);
    });

    it("indexed 8-bit register getter", () => {
      cpu.B = 0x01;
      cpu.C = 0x23;
      cpu.D = 0x45;
      cpu.E = 0x67;
      cpu.H = 0x89;
      cpu.L = 0xab;
      mmu.writeMmap(0x89ab, 0xcd);
      cpu.A = 0xef;

      expect(cpu.getReg8(B_INDEX)).toEqual(0x01);
      expect(cpu.getReg8(C_INDEX)).toEqual(0x23);
      expect(cpu.getReg8(D_INDEX)).toEqual(0x45);
      expect(cpu.getReg8(E_INDEX)).toEqual(0x67);
      expect(cpu.getReg8(H_INDEX)).toEqual(0x89);
      expect(cpu.getReg8(L_INDEX)).toEqual(0xab);
      expect(cpu.getReg8(MEM_AT_HL_INDEX)).toEqual(0xcd);
      expect(cpu.getReg8(A_INDEX)).toEqual(0xef);
    });

    it("indexed 8-bit register setter", () => {
      cpu.setReg8(B_INDEX, 0xfe);
      cpu.setReg8(C_INDEX, 0xdc);
      cpu.setReg8(D_INDEX, 0xba);
      cpu.setReg8(E_INDEX, 0x98);
      cpu.setReg8(H_INDEX, 0x76);
      cpu.setReg8(L_INDEX, 0x54);
      cpu.setReg8(MEM_AT_HL_INDEX, 0x32);
      cpu.setReg8(A_INDEX, 0x10);

      expect(cpu.B).toEqual(0xfe);
      expect(cpu.C).toEqual(0xdc);
      expect(cpu.D).toEqual(0xba);
      expect(cpu.E).toEqual(0x98);
      expect(cpu.H).toEqual(0x76);
      expect(cpu.L).toEqual(0x54);
      expect(mmu.readMmap(cpu.getHL())).toEqual(0x32);
      expect(cpu.A).toEqual(0x10);
    });

    it("indexed 16-bit register getter", () => {
      cpu.B = 0x01;
      cpu.C = 0x23;
      cpu.D = 0x45;
      cpu.E = 0x67;
      cpu.H = 0x89;
      cpu.L = 0xab;
      cpu.A = 0xef;
      cpu.zero = true;
      cpu.subtract = false;
      cpu.halfCarry = true;
      cpu.carry = false;
      cpu.SP = 0x1234;

      expect(cpu.getReg16(BC_INDEX, RegIndexType.Normal)).toEqual(0x0123);
      expect(cpu.getReg16(DE_INDEX, RegIndexType.Normal)).toEqual(0x4567);
      expect(cpu.getReg16(HL_HLI_INDEX, RegIndexType.Normal)).toEqual(0x89ab);
      expect(cpu.getReg16(SP_AF_HLD_INDEX, RegIndexType.Normal)).toEqual(
        0x1234
      );

      expect(cpu.getReg16(BC_INDEX, RegIndexType.Stack)).toEqual(0x0123);
      expect(cpu.getReg16(DE_INDEX, RegIndexType.Stack)).toEqual(0x4567);
      expect(cpu.getReg16(HL_HLI_INDEX, RegIndexType.Stack)).toEqual(0x89ab);
      expect(cpu.getReg16(SP_AF_HLD_INDEX, RegIndexType.Stack)).toEqual(0xefa0);

      expect(cpu.getReg16(BC_INDEX, RegIndexType.Memory)).toEqual(0x0123);
      expect(cpu.getReg16(DE_INDEX, RegIndexType.Memory)).toEqual(0x4567);
      expect(cpu.getReg16(HL_HLI_INDEX, RegIndexType.Memory)).toEqual(0x89ab);
      expect(cpu.getHL()).toEqual(0x89ac);
      expect(cpu.getReg16(SP_AF_HLD_INDEX, RegIndexType.Memory)).toEqual(
        0x89ac
      );
      expect(cpu.getHL()).toEqual(0x89ab);
    });
  });

  describe("instruction tests", () => {
    const reg8Indices = [0, 1, 2, 3, 4, 5, 6, 7];

    describe("8-bit transfer + i/o instruction tests", () => {
      it("ld r8, r8'", () => {
        for (const r8 of reg8Indices) {
          for (const r8Prime of reg8Indices) {
            if (r8 !== MEM_AT_HL_INDEX || r8Prime !== MEM_AT_HL_INDEX) {
              cpu.B = 0x01;
              cpu.C = 0x23;
              cpu.D = 0x45;
              cpu.E = 0x67;
              cpu.H = 0x89;
              cpu.L = 0xab;
              mmu.writeMmap(0x89ab, 0xcd);
              cpu.A = 0xef;
              const r1Val = cpu.getReg8(r8Prime);

              setTestInstruction(cgb, reg8Opcode(0b01, r8, r8Prime));
              expect(cpu.step()).toEqual(
                r8 === MEM_AT_HL_INDEX || r8Prime === MEM_AT_HL_INDEX ? 2 : 1
              );
              expect(cpu.getReg8(r8)).toEqual(r1Val);
            }
          }
        }
      });

      it("ld r8, imm8", () => {
        for (const reg of reg8Indices) {
          mmu.writeMmap(1, 0x12);

          setTestInstruction(cgb, reg8Opcode(0b00, reg, 0b110));
          expect(cpu.step()).toEqual(reg === MEM_AT_HL_INDEX ? 3 : 2);
          expect(cpu.getReg8(reg)).toEqual(0x12);
        }
      });

      it("ld a, [r16]", () => {
        cpu.B = 0x01;
        cpu.C = 0x23;
        cpu.D = 0x45;
        cpu.E = 0x67;
        cpu.H = 0x89;
        cpu.L = 0xab;

        mmu.writeMmap(cpu.getBC(), 0x76);
        mmu.writeMmap(cpu.getDE(), 0x54);
        mmu.writeMmap(cpu.getHL(), 0x32);
        mmu.writeMmap(cpu.getHL() + 1, 0x10);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b00, 0b1010));
        expect(cpu.step()).toEqual(2);
        expect(cpu.A).toEqual(0x76);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b01, 0b1010));
        expect(cpu.step()).toEqual(2);
        expect(cpu.A).toEqual(0x54);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b10, 0b1010));
        expect(cpu.step()).toEqual(2);
        expect(cpu.A).toEqual(0x32);
        expect(cpu.getHL()).toEqual(0x89ac);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b11, 0b1010));
        expect(cpu.step()).toEqual(2);
        expect(cpu.A).toEqual(0x10);
        expect(cpu.getHL()).toEqual(0x89ab);
      });

      it("ld [r16], a", () => {
        cpu.A = 0xff;
        cpu.B = 0x01;
        cpu.C = 0x23;
        cpu.D = 0x45;
        cpu.E = 0x67;
        cpu.H = 0x89;
        cpu.L = 0xab;

        setTestInstruction(cgb, reg16Opcode(0b00, 0b00, 0b0010));
        expect(cpu.step()).toEqual(2);
        expect(mmu.readMmap(0x0123)).toEqual(0xff);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b01, 0b0010));
        expect(cpu.step()).toEqual(2);
        expect(mmu.readMmap(0x4567)).toEqual(0xff);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b10, 0b0010));
        expect(cpu.step()).toEqual(2);
        expect(mmu.readMmap(0x89ab)).toEqual(0xff);
        expect(cpu.getHL()).toEqual(0x89ac);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b11, 0b0010));
        expect(cpu.step()).toEqual(2);
        expect(mmu.readMmap(0x89ac)).toEqual(0xff);
        expect(cpu.getHL()).toEqual(0x89ab);
      });

      it("ld a, [c]", () => {
        cpu.C = 0x12;
        mmu.writeMmap(0xff12, 0x34);

        setTestInstruction(cgb, 0xf2);
        expect(cpu.step()).toEqual(2);
        expect(cpu.A).toEqual(0x34);
      });

      it("ld [c], a", () => {
        cpu.C = 0x12;
        cpu.A = 0x89;

        setTestInstruction(cgb, 0xe2);
        expect(cpu.step()).toEqual(2);
        expect(mmu.readMmap(0xff12)).toEqual(0x89);
      });

      it("ld a, [imm8]", () => {
        mmu.writeMmap(1, 0x98);
        mmu.writeMmap(0xff98, 0x76);

        setTestInstruction(cgb, 0xf0);
        expect(cpu.step()).toEqual(3);
        expect(cpu.A).toEqual(0x76);
      });

      it("ld [imm8], a", () => {
        cpu.A = 0x44;
        mmu.writeMmap(1, 0x54);

        setTestInstruction(cgb, 0xe0);
        expect(cpu.step()).toEqual(3);
        expect(mmu.readMmap(0xff54)).toEqual(0x44);
      });

      it("ld a, [imm16]", () => {
        mmu.writeMmap(1, 0x23);
        mmu.writeMmap(2, 0x01);
        mmu.writeMmap(0x0123, 0xdc);

        setTestInstruction(cgb, 0xfa);
        expect(cpu.step()).toEqual(4);
        expect(cpu.A).toEqual(0xdc);
      });

      it("ld [imm16], a", () => {
        cpu.A = 0x77;
        mmu.writeMmap(1, 0xdc);
        mmu.writeMmap(2, 0xcd);

        setTestInstruction(cgb, 0xea);
        expect(cpu.step()).toEqual(4);
        expect(mmu.readMmap(0xcddc)).toEqual(0x77);
      });
    });

    describe("16-bit transfer instruction tests", () => {
      it("ld r16, imm16", () => {
        mmu.writeMmap(1, 0x34);
        mmu.writeMmap(2, 0x12);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b00, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getBC()).toEqual(0x1234);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b01, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getDE()).toEqual(0x1234);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b10, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getHL()).toEqual(0x1234);

        setTestInstruction(cgb, reg16Opcode(0b00, 0b11, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.SP).toEqual(0x1234);
      });

      it("ld sp, hl", () => {
        cpu.setHL(0x1122);

        setTestInstruction(cgb, 0xf9);
        expect(cpu.step()).toEqual(2);
        expect(cpu.SP).toEqual(0x1122);
      });

      it("ldhl sp, imm8", () => {
        // TODO
      });

      it("ld [imm16], sp", () => {
        cpu.SP = 0x3344;
        mmu.writeMmap(1, 0x56);
        mmu.writeMmap(2, 0x34);

        setTestInstruction(cgb, 0x08);
        expect(cpu.step()).toEqual(5);
        expect(mmu.readMmap(0x3456)).toEqual(0x44);
        expect(mmu.readMmap(0x3457)).toEqual(0x33);
      });

      it("push r16", () => {
        cpu.setBC(0xfedc);
        cpu.setDE(0xba98);
        cpu.setHL(0x7654);
        cpu.setAF(0x32f0);
        cpu.SP = 0x1000;

        setTestInstruction(cgb, reg16Opcode(0b11, 0b00, 0b0101));
        expect(cpu.step()).toEqual(4);
        expect(mmu.readMmap(0x0fff)).toEqual(0xfe);
        expect(mmu.readMmap(0x0ffe)).toEqual(0xdc);
        expect(cpu.SP).toEqual(0x0ffe);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b01, 0b0101));
        expect(cpu.step()).toEqual(4);
        expect(mmu.readMmap(0x0ffd)).toEqual(0xba);
        expect(mmu.readMmap(0x0ffc)).toEqual(0x98);
        expect(cpu.SP).toEqual(0x0ffc);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b10, 0b0101));
        expect(cpu.step()).toEqual(4);
        expect(mmu.readMmap(0x0ffb)).toEqual(0x76);
        expect(mmu.readMmap(0x0ffa)).toEqual(0x54);
        expect(cpu.SP).toEqual(0x0ffa);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b11, 0b0101));
        expect(cpu.step()).toEqual(4);
        expect(mmu.readMmap(0x0ff9)).toEqual(0x32);
        expect(mmu.readMmap(0x0ff8)).toEqual(0xf0);
        expect(cpu.SP).toEqual(0x0ff8);
      });

      it("pop r16", () => {
        cpu.SP = 0x0ff8;
        mmu.writeMmap(0x0ff8, 0x23);
        mmu.writeMmap(0x0ff9, 0x01);
        mmu.writeMmap(0x0ffa, 0x67);
        mmu.writeMmap(0x0ffb, 0x45);
        mmu.writeMmap(0x0ffc, 0xab);
        mmu.writeMmap(0x0ffd, 0x89);
        mmu.writeMmap(0x0ffe, 0xf0);
        mmu.writeMmap(0x0fff, 0xcd);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b00, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getBC()).toEqual(0x0123);
        expect(cpu.SP).toEqual(0x0ffa);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b01, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getDE()).toEqual(0x4567);
        expect(cpu.SP).toEqual(0x0ffc);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b10, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getHL()).toEqual(0x89ab);
        expect(cpu.SP).toEqual(0x0ffe);

        setTestInstruction(cgb, reg16Opcode(0b11, 0b11, 0b0001));
        expect(cpu.step()).toEqual(3);
        expect(cpu.getAF()).toEqual(0xcdf0);
        expect(cpu.SP).toEqual(0x1000);
      });
    });
  });
});

function reg8Opcode(block: number, r8: number, r8Prime: number): number {
  return (block << (REG_8_SHIFT * 2)) | (r8 << REG_8_SHIFT) | r8Prime;
}

function reg16Opcode(block: number, r16: number, nibble: number): number {
  return (block << (REG_8_SHIFT * 2)) | (r16 << REG_16_SHIFT) | nibble;
}

function setTestInstruction(cgb: CGB, opcode: number) {
  cgb.cpu.PC = 0;
  cgb.mmu.writeMmap(0, opcode);
}
