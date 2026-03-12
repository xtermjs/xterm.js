/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class AddonLigaturesWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-ligatures';
  public readonly label = 'ligatures';

  public build(container: HTMLElement): void {
    const dl = document.createElement('dl');
    const dt = document.createElement('dt');
    dt.textContent = 'Ligatures Addon';
    dl.appendChild(dt);

    const dd = document.createElement('dd');
    const button = document.createElement('button');
    button.id = 'ligatures-test';
    button.textContent = 'Common ligatures';
    button.title = 'Write common ligatures sequences';
    button.addEventListener('click', () => this._ligaturesTest());
    dd.appendChild(button);
    dl.appendChild(dd);

    container.appendChild(dl);
  }

  private _ligaturesTest(): void {
    this._terminal.write([
      '',
      '-<< -< -<- <-- <--- <<- <- -> ->> --> ---> ->- >- >>-',
      '=<< =< =<= <== <=== <<= <= => =>> ==> ===> =>= >= >>=',
      '<-> <--> <---> <----> <=> <==> <===> <====> :: ::: __',
      '<~~ </ </> /> ~~> == != /= ~= <> === !== !=== =/= =!=',
      '<: := *= *+ <* <*> *> <| <|> |> <. <.> .> +* =* =: :>',
      '(* *) /* */ [| |] {| |} ++ +++ \/ /\ |- -| <!-- <!---',
      '==== ===== ====== ======= ======== =========',
      '---- ----- ------ ------- -------- ---------'
    ].join('\r\n'));
  }
}
