/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const userAgent = typeof navigator === 'object' ? navigator.userAgent : '';

export const isFirefox = (userAgent.indexOf('Firefox') >= 0);
export const isChrome = (userAgent.indexOf('Chrome') >= 0);
export const isSafari = (!isChrome && (userAgent.indexOf('Safari') >= 0));

export function getZoomFactor(_targetWindow: Window): number {
  return 1;
}
