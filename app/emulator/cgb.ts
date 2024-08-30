import { CPU } from "./cpu";
import { MMU } from "./mmu";

export class CGB {
  cpu: CPU;
  mmu: MMU;

  constructor() {
    this.mmu = new MMU(this);
    this.cpu = new CPU(this);
  }
}
