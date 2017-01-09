import { C0 } from './EscapeSequences';
import { IInputHandler } from './Interfaces';

export const normalStateHandler: {[key: string]: (handler: IInputHandler) => void} = {};
normalStateHandler[C0.BEL] = (handler) => handler.bell();
normalStateHandler[C0.LF] = (handler) => handler.lineFeed();
normalStateHandler[C0.VT] = normalStateHandler[C0.LF];
normalStateHandler[C0.FF] = normalStateHandler[C0.LF];
normalStateHandler[C0.CR] = (handler) => handler.carriageReturn();
normalStateHandler[C0.HT] = (handler) => handler.tab();
normalStateHandler[C0.SO] = (handler) => handler.shiftOut();
normalStateHandler[C0.SI] = (handler) => handler.shiftIn();
