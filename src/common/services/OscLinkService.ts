/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IBufferService, IOscLinkService } from 'common/services/Services';
import { IMarker, IOscLinkData } from 'common/Types';

export class OscLinkService implements IOscLinkService {
  public serviceBrand: any;

  private _nextId = 1;

  // TODO: Evict on marker dispose
  private _entriesNoId: IOscLinkEntryNoId[] = [];
  private _entriesWithId: Map<string, IOscLinkEntryWithId> = new Map();

  // The "link id" (number) which is the numberic representation of a unique link should not be
  // confused with "id" (string) which comes in with "id=" in the OSC link's properties
  private _dataByLinkId: Map<number, IOscLinkEntryNoId | IOscLinkEntryWithId> = new Map();

  constructor(
    @IBufferService private readonly _bufferService: IBufferService
  ) {
  }

  public registerLink(data: IOscLinkData): number {
    const buffer = this._bufferService.buffer;

    // Links with no id will only ever be registered a single time
    if (data.id === undefined) {
      const entry: IOscLinkEntryNoId = {
        data,
        id: this._nextId++,
        lines: [buffer.addMarker(buffer.ybase + buffer.y)]
      };
      this._entriesNoId.push(entry);
      this._dataByLinkId.set(entry.id, entry);
      return entry.id;
    }

    // Add the line to the link if it already exists
    const castData = data as Required<IOscLinkData>;
    const key = this._getEntryIdKey(castData);
    const match = this._entriesWithId.get(key);
    if (match) {
      this.addLineToLink(match.id, buffer.ybase + buffer.y);
      return match.id;
    }

    // Create the link
    const entry: IOscLinkEntryWithId = {
      id: this._nextId++,
      key: this._getEntryIdKey(castData),
      data: castData,
      lines: [buffer.addMarker(buffer.ybase + buffer.y)]
    };
    this._entriesWithId.set(entry.key, entry);
    this._dataByLinkId.set(entry.id, entry);
    return entry.id;
  }

  public addLineToLink(linkId: number, y: number): void {
    const link = this._dataByLinkId.get(linkId);
    if (!link) {
      return;
    }
    if (link.lines.every(e => e.line !== y)) {
      link.lines.push(this._bufferService.buffer.addMarker(y));
    }
  }

  public getLinkData(linkId: number): IOscLinkData | undefined {
    return this._dataByLinkId.get(linkId)?.data;
  }

  private _getEntryIdKey(linkData: Required<IOscLinkData>): string {
    return `${linkData.id};;${linkData.uri}`;
  }
}

interface IOscLinkEntry<T extends IOscLinkData> {
  data: T;
  id: number;
  lines: IMarker[];
}

interface IOscLinkEntryNoId extends IOscLinkEntry<IOscLinkData> {
}

interface IOscLinkEntryWithId extends IOscLinkEntry<Required<IOscLinkData>> {
  key: string;
}
