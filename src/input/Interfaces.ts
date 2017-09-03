export interface IMouseZoneManager {
  add(zone: IMouseZone): void;
  clearAll(): void;
}

export interface IMouseZone {
  x1: number;
  x2: number;
  y: number;
  clickCallback: (e: MouseEvent) => any;
  hoverCallback?: (e: MouseEvent) => any;
}
