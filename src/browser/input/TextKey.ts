/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Standard `KeyboardEvent.key` values with more than one character.
 * https://www.w3.org/TR/uievents-key/#named-key-attribute-values
 */
const NAMED_KEYS: ReadonlySet<string> = new Set([
  'Unidentified',
  'Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'FnLock', 'Meta', 'NumLock', 'ScrollLock', 'Shift', 'Symbol', 'SymbolLock', 'Hyper', 'Super',
  'Enter', 'Tab',
  'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp',
  'Backspace', 'Clear', 'Copy', 'CrSel', 'Cut', 'Delete', 'EraseEof', 'ExSel', 'Insert', 'Paste', 'Redo', 'Undo',
  'Accept', 'Again', 'Attn', 'Cancel', 'ContextMenu', 'Escape', 'Execute', 'Find', 'Help', 'Pause', 'Play', 'Props', 'Select', 'ZoomIn', 'ZoomOut',
  'BrightnessDown', 'BrightnessUp', 'Eject', 'LogOff', 'Power', 'PowerOff', 'PrintScreen', 'Hibernate', 'Standby', 'WakeUp',
  'AllCandidates', 'Alphanumeric', 'CodeInput', 'Compose', 'Convert', 'Dead', 'FinalMode', 'GroupFirst', 'GroupLast', 'GroupNext', 'GroupPrevious',
  'ModeChange', 'NextCandidate', 'NonConvert', 'PreviousCandidate', 'Process', 'SingleCandidate',
  'HangulMode', 'HanjaMode', 'JunjaMode', 'Eisu', 'Hankaku', 'Hiragana', 'HiraganaKatakana', 'KanaMode', 'KanjiMode', 'Katakana', 'Romaji', 'Zenkaku', 'ZenkakuHankaku',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24',
  'Soft1', 'Soft2', 'Soft3', 'Soft4',
  'ChannelDown', 'ChannelUp', 'Close', 'MailForward', 'MailReply', 'MailSend', 'MediaClose', 'MediaFastForward', 'MediaPause', 'MediaPlay',
  'MediaPlayPause', 'MediaRecord', 'MediaRewind', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious', 'New', 'Open', 'Print', 'Save', 'SpellCheck',
  'AudioBalanceLeft', 'AudioBalanceRight', 'AudioBassBoostDown', 'AudioBassBoostToggle', 'AudioBassBoostUp', 'AudioFaderFront', 'AudioFaderRear',
  'AudioSurroundModeNext', 'AudioTrebleDown', 'AudioTrebleUp', 'AudioVolumeDown', 'AudioVolumeUp', 'AudioVolumeMute',
  'MicrophoneToggle', 'MicrophoneVolumeDown', 'MicrophoneVolumeUp', 'MicrophoneVolumeMute',
  'SpeechCorrectionList', 'SpeechInputToggle',
  'LaunchApplication1', 'LaunchApplication2', 'LaunchCalendar', 'LaunchContacts', 'LaunchMail', 'LaunchMediaPlayer', 'LaunchMusicPlayer',
  'LaunchPhone', 'LaunchScreenSaver', 'LaunchSpreadsheet', 'LaunchWebBrowser', 'LaunchWebCam', 'LaunchWordProcessor',
  'BrowserBack', 'BrowserFavorites', 'BrowserForward', 'BrowserHome', 'BrowserRefresh', 'BrowserSearch', 'BrowserStop',
  'AppSwitch', 'Call', 'Camera', 'CameraFocus', 'EndCall', 'GoBack', 'GoHome', 'HeadsetHook', 'LastNumberRedial', 'Notification', 'MannerMode', 'VoiceDial',
  'TV', 'TV3DMode', 'TVAntennaCable', 'TVAudioDescription', 'TVAudioDescriptionMixDown', 'TVAudioDescriptionMixUp', 'TVContentsMenu', 'TVDataService',
  'TVInput', 'TVInputComponent1', 'TVInputComponent2', 'TVInputComposite1', 'TVInputComposite2', 'TVInputHDMI1', 'TVInputHDMI2', 'TVInputHDMI3',
  'TVInputHDMI4', 'TVInputVGA1', 'TVMediaContext', 'TVNetwork', 'TVNumberEntry', 'TVPower', 'TVRadioService', 'TVSatellite', 'TVSatelliteBS',
  'TVSatelliteCS', 'TVSatelliteToggle', 'TVTerrestrialAnalog', 'TVTerrestrialDigital', 'TVTimer',
  'AVRInput', 'AVRPower', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ColorF4Grey', 'ColorF5Brown',
  'ClosedCaptionToggle', 'Dimmer', 'DisplaySwap', 'DVR', 'Exit', 'FavoriteClear0', 'FavoriteClear1', 'FavoriteClear2', 'FavoriteClear3',
  'FavoriteRecall0', 'FavoriteRecall1', 'FavoriteRecall2', 'FavoriteRecall3', 'FavoriteStore0', 'FavoriteStore1', 'FavoriteStore2', 'FavoriteStore3',
  'Guide', 'GuideNextDay', 'GuidePreviousDay', 'Info', 'InstantReplay', 'Link', 'ListProgram', 'LiveContent', 'Lock', 'MediaApps', 'MediaAudioTrack',
  'MediaLast', 'MediaSkipBackward', 'MediaSkipForward', 'MediaStepBackward', 'MediaStepForward', 'MediaTopMenu', 'NavigateIn', 'NavigateNext',
  'NavigateOut', 'NavigatePrevious', 'NextFavoriteChannel', 'NextUserProfile', 'OnDemand', 'Pairing', 'PinPDown', 'PinPMove', 'PinPToggle', 'PinPUp',
  'PlaySpeedDown', 'PlaySpeedReset', 'PlaySpeedUp', 'RandomToggle', 'RcLowBattery', 'RecordSpeedNext', 'RfBypass', 'ScanChannelsToggle',
  'ScreenModeNext', 'Settings', 'SplitScreenToggle', 'STBInput', 'STBPower', 'Subtitle', 'Teletext', 'VideoModeNext', 'Wink', 'ZoomToggle'
]);

/**
 * Whether `key` is text (several characters, not a named key) that an accessibility-API writer
 * such as macOS dictation put in `KeyboardEvent.key` while leaving `keyCode` at the first letter.
 */
export function isTextKey(key: string | undefined): boolean {
  if (!key || NAMED_KEYS.has(key)) {
    return false;
  }
  // Spread iterates by code point, so a single emoji still counts as one character.
  return [...key].length > 1;
}
