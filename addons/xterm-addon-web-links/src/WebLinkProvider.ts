import { ILinkProvider, IBufferCellPosition, ILink, Terminal, IBuffer } from 'xterm';
import { CharCode } from './charCode';
import { CharacterClassifier } from './characterClassifier';


export default class WebLinkProvider implements ILinkProvider {

  constructor(
    private readonly _terminal: Terminal,
    private readonly _handler: (event: MouseEvent, uri: string) => void
  ) {

  }

  provideLink(position: IBufferCellPosition, callback: (link: ILink | undefined) => void): void {
    const link = LinkComputer.computeLink(position, this._terminal.buffer);

    if (link) {
      link.handle = this._handler;
    }

    callback(link);
  }
}

export const enum State {
  INVALID = 0,
  START = 1,
  H = 2,
  HT = 3,
  HTT = 4,
  HTTP = 5,
  F = 6,
  FI = 7,
  FIL = 8,
  BEFORE_COLON = 9,
  AFTER_COLON = 10,
  ALMOST_THERE = 11,
  END = 12,
  ACCEPT = 13,
  LAST_KNOWN_STATE = 14 // marker, custom states may follow
}

export type Edge = [State, number, State];

export class Uint8Matrix {

  private readonly _data: Uint8Array;
  public readonly rows: number;
  public readonly cols: number;

  constructor(rows: number, cols: number, defaultValue: number) {
    const data = new Uint8Array(rows * cols);
    const len = rows * cols;
    for (let i = 0; i < len; i++) {
      data[i] = defaultValue;
    }

    this._data = data;
    this.rows = rows;
    this.cols = cols;
  }

  public get(row: number, col: number): number {
    return this._data[row * this.cols + col];
  }

  public set(row: number, col: number, value: number): void {
    this._data[row * this.cols + col] = value;
  }
}

export class StateMachine {

  private readonly _states: Uint8Matrix;
  private readonly _maxCharCode: number;

  constructor(edges: Edge[]) {
    let maxCharCode = 0;
    let maxState = State.INVALID;
    for (let i = 0; i < edges.length; i++) {
      const [from, chCode, to] = edges[i];
      if (chCode > maxCharCode) {
        maxCharCode = chCode;
      }
      if (from > maxState) {
        maxState = from;
      }
      if (to > maxState) {
        maxState = to;
      }
    }

    maxCharCode++;
    maxState++;

    const states = new Uint8Matrix(maxState, maxCharCode, State.INVALID);
    for (let i = 0; i < edges.length; i++) {
      const [from, chCode, to] = edges[i];
      states.set(from, chCode, to);
    }

    this._states = states;
    this._maxCharCode = maxCharCode;
  }

  public nextState(currentState: State, chCode: number): State {
    if (chCode < 0 || chCode >= this._maxCharCode) {
      return State.INVALID;
    }
    return this._states.get(currentState, chCode);
  }
}

// State machine for http:// or https:// or file://
let stateMachine: StateMachine | null = null;
function getStateMachine(): StateMachine {
  if (stateMachine === null) {
    stateMachine = new StateMachine([
      [State.START, CharCode.h, State.H],
      [State.START, CharCode.H, State.H],
      [State.START, CharCode.f, State.F],
      [State.START, CharCode.F, State.F],

      [State.H, CharCode.t, State.HT],
      [State.H, CharCode.T, State.HT],

      [State.HT, CharCode.t, State.HTT],
      [State.HT, CharCode.T, State.HTT],

      [State.HTT, CharCode.p, State.HTTP],
      [State.HTT, CharCode.P, State.HTTP],

      [State.HTTP, CharCode.s, State.BEFORE_COLON],
      [State.HTTP, CharCode.S, State.BEFORE_COLON],
      [State.HTTP, CharCode.Colon, State.AFTER_COLON],

      [State.F, CharCode.i, State.FI],
      [State.F, CharCode.I, State.FI],

      [State.FI, CharCode.l, State.FIL],
      [State.FI, CharCode.L, State.FIL],

      [State.FIL, CharCode.e, State.BEFORE_COLON],
      [State.FIL, CharCode.E, State.BEFORE_COLON],

      [State.BEFORE_COLON, CharCode.Colon, State.AFTER_COLON],

      [State.AFTER_COLON, CharCode.Slash, State.ALMOST_THERE],

      [State.ALMOST_THERE, CharCode.Slash, State.END]
    ]);
  }
  return stateMachine;
}


const enum CharacterClass {
  NONE = 0,
  FORCE_TERMINATION = 1,
  CANNOT_END_IN = 2
}

let classifier: CharacterClassifier<CharacterClass> | null = null;
function getClassifier(): CharacterClassifier<CharacterClass> {
  if (classifier === null) {
    classifier = new CharacterClassifier<CharacterClass>(CharacterClass.NONE);

    const FORCE_TERMINATION_CHARACTERS = ' \t<>\'\"、。｡､，．：；？！＠＃＄％＆＊‘“〈《「『【〔（［｛｢｣｝］）〕】』」》〉”’｀～…';
    for (let i = 0; i < FORCE_TERMINATION_CHARACTERS.length; i++) {
      classifier.set(FORCE_TERMINATION_CHARACTERS.charCodeAt(i), CharacterClass.FORCE_TERMINATION);
    }

    const CANNOT_END_WITH_CHARACTERS = '.,;';
    for (let i = 0; i < CANNOT_END_WITH_CHARACTERS.length; i++) {
      classifier.set(CANNOT_END_WITH_CHARACTERS.charCodeAt(i), CharacterClass.CANNOT_END_IN);
    }
  }
  return classifier;
}

export class LinkComputer {

  private static _createLink(classifier: CharacterClassifier<CharacterClass>, line: string, lineNumber: number, linkBeginIndex: number, linkEndIndex: number): ILink {
    // Do not allow to end link in certain characters...
    let lastIncludedCharIndex = linkEndIndex - 1;
    do {
      const chCode = line.charCodeAt(lastIncludedCharIndex);
      const chClass = classifier.get(chCode);
      if (chClass !== CharacterClass.CANNOT_END_IN) {
        break;
      }
      lastIncludedCharIndex--;
    } while (lastIncludedCharIndex > linkBeginIndex);

    // Handle links enclosed in parens, square brackets and curlys.
    if (linkBeginIndex > 0) {
      const charCodeBeforeLink = line.charCodeAt(linkBeginIndex - 1);
      const lastCharCodeInLink = line.charCodeAt(lastIncludedCharIndex);

      if (
        (charCodeBeforeLink === CharCode.OpenParen && lastCharCodeInLink === CharCode.CloseParen)
        || (charCodeBeforeLink === CharCode.OpenSquareBracket && lastCharCodeInLink === CharCode.CloseSquareBracket)
        || (charCodeBeforeLink === CharCode.OpenCurlyBrace && lastCharCodeInLink === CharCode.CloseCurlyBrace)
      ) {
        // Do not end in ) if ( is before the link start
        // Do not end in ] if [ is before the link start
        // Do not end in } if { is before the link start
        lastIncludedCharIndex--;
      }
    }

    return {
      range: {
        start: {
          x: linkBeginIndex + 1,
          y: lineNumber
        },
        end: {
          x: lastIncludedCharIndex + 2,
          y: lineNumber
        }
      },
      url: line.substring(linkBeginIndex, lastIncludedCharIndex + 1),
      showTooltip: (event: MouseEvent, link: string) => console.log('Show toolip for ' + link),
      hideTooltip: (event: MouseEvent, link: string) => console.log('Hide tooltip for ' + link),
      handle: (event: MouseEvent, link: string) => { }
    };
  }

  public static computeLink(position: IBufferCellPosition, buffer: IBuffer): ILink | undefined {
    const stateMachine: StateMachine = getStateMachine();
    const classifier = getClassifier();

    const bufferLine = buffer.getLine(position.y - 1);

    if (!bufferLine) {
      return;
    }

    const line = bufferLine.translateToString();
    const len = line.length;

    const i = position.y;

    let linkBeginIndex = position.x - 1;
    let state = State.START;
    let hasOpenParens = false;
    let hasOpenSquareBracket = false;
    let hasOpenCurlyBracket = false;

    while (linkBeginIndex >= 0) {
      let j = linkBeginIndex;
      while (j < len) {
        const linkBeginChCode = line.charCodeAt(j);
        const chCode = line.charCodeAt(j);

        if (state === State.ACCEPT) {
          let chClass: CharacterClass;
          switch (chCode) {
            case CharCode.OpenParen:
              hasOpenParens = true;
              chClass = CharacterClass.NONE;
              break;
            case CharCode.CloseParen:
              chClass = (hasOpenParens ? CharacterClass.NONE : CharacterClass.FORCE_TERMINATION);
              break;
            case CharCode.OpenSquareBracket:
              hasOpenSquareBracket = true;
              chClass = CharacterClass.NONE;
              break;
            case CharCode.CloseSquareBracket:
              chClass = (hasOpenSquareBracket ? CharacterClass.NONE : CharacterClass.FORCE_TERMINATION);
              break;
            case CharCode.OpenCurlyBrace:
              hasOpenCurlyBracket = true;
              chClass = CharacterClass.NONE;
              break;
            case CharCode.CloseCurlyBrace:
              chClass = (hasOpenCurlyBracket ? CharacterClass.NONE : CharacterClass.FORCE_TERMINATION);
              break;
            /* The following three rules make it that ' or " or ` are allowed inside links if the link began with a different one */
            case CharCode.SingleQuote:
              chClass = (linkBeginChCode === CharCode.DoubleQuote || linkBeginChCode === CharCode.BackTick) ? CharacterClass.NONE : CharacterClass.FORCE_TERMINATION;
              break;
            case CharCode.DoubleQuote:
              chClass = (linkBeginChCode === CharCode.SingleQuote || linkBeginChCode === CharCode.BackTick) ? CharacterClass.NONE : CharacterClass.FORCE_TERMINATION;
              break;
            case CharCode.BackTick:
              chClass = (linkBeginChCode === CharCode.SingleQuote || linkBeginChCode === CharCode.DoubleQuote) ? CharacterClass.NONE : CharacterClass.FORCE_TERMINATION;
              break;
            case CharCode.Asterisk:
              // `*` terminates a link if the link began with `*`
              chClass = (linkBeginChCode === CharCode.Asterisk) ? CharacterClass.FORCE_TERMINATION : CharacterClass.NONE;
              break;
            default:
              chClass = classifier.get(chCode);
          }

          // Check if character terminates link
          if (chClass === CharacterClass.FORCE_TERMINATION) {
            return LinkComputer._createLink(classifier, line, i, linkBeginIndex, j);
          }
        } else if (state === State.END) {

          let chClass: CharacterClass;
          if (chCode === CharCode.OpenSquareBracket) {
            // Allow for the authority part to contain ipv6 addresses which contain [ and ]
            hasOpenSquareBracket = true;
            chClass = CharacterClass.NONE;
          } else {
            chClass = classifier.get(chCode);
          }

          // Check if character terminates link
          if (chClass === CharacterClass.FORCE_TERMINATION) {
            return;
          }

          state = State.ACCEPT;
        } else {
          state = stateMachine.nextState(state, chCode);
          if (state === State.INVALID) {
            // Two spaces in a row, return
            if (chCode === CharCode.Space && j > 0 && line.charCodeAt(j - 1) === CharCode.Space) {
              return;
            }

            // Reset state machine
            state = State.START;
            hasOpenParens = false;
            hasOpenSquareBracket = false;
            hasOpenCurlyBracket = false;

            // Move to the left
            linkBeginIndex--;
            break;
          }
        }

        j++;
      }

      if (state === State.ACCEPT) {
        return LinkComputer._createLink(classifier, line, i, linkBeginIndex, len);
      }
    }
  }
}
