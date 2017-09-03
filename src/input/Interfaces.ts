export interface IMouseZoneManager {
  add(zone: IMouseZone): void;
  clearAll(): void;
}

export interface IMouseZone {
  x1: number;
  x2: number;
  y: number;
  hoverCallback: (e: MouseEvent) => any;
  clickCallback: (e: MouseEvent) => any;
}
