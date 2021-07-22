import { IBuffer } from 'common/buffer/Types';
import { CoreTerminal } from 'common/CoreTerminal';
import { IEvent } from 'common/EventEmitter';
import { ITerminalOptions as IInitializedTerminalOptions } from 'common/services/Services';
import { IMarker, ITerminalOptions } from 'common/Types';
export declare class Terminal extends CoreTerminal {
    get options(): IInitializedTerminalOptions;
    private _onBell;
    get onBell(): IEvent<void>;
    private _onCursorMove;
    get onCursorMove(): IEvent<void>;
    private _onTitleChange;
    get onTitleChange(): IEvent<string>;
    private _onA11yCharEmitter;
    get onA11yChar(): IEvent<string>;
    private _onA11yTabEmitter;
    get onA11yTab(): IEvent<number>;
    constructor(options?: ITerminalOptions);
    dispose(): void;
    get buffer(): IBuffer;
    get markers(): IMarker[];
    addMarker(cursorYOffset: number): IMarker | undefined;
    bell(): void;
    resize(x: number, y: number): void;
    clear(): void;
    reset(): void;
}
//# sourceMappingURL=Terminal.d.ts.map