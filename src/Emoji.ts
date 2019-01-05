// This function returns whether the first code point of the provided string is
// within a range that contains emoji. Some of the codepoints in these ranges
// are unassigned so this test is an approximation to the real thing.
// Ranges taken from:
//   https://stackoverflow.com/questions/30757193/
// For a complete list of all assigned codepoints, go to:
//   https://unicode.org/Public/emoji/11.0/emoji-data.txt
export function isEmoji(str: string): boolean {
  if (str.codePointAt === undefined) {
    return false;
  }
  const codePoint = str.codePointAt(0);
  // Short circuit for the most common case (i.e. non-emoji characters)
  if (codePoint < 8400) {
    return false;
  }
  if ((codePoint >= 0x1F600 && codePoint <= 0x1F64F) || // Emoticons
      (codePoint >= 0x1F300 && codePoint <= 0x1F5FF) || // Misc Symbols and Pictographs
      (codePoint >= 0x1F680 && codePoint <= 0x1F6FF) || // Transport and Map
      (codePoint >= 0x1F1E6 && codePoint <= 0x1F1FF) || // Regional country flags
      (codePoint >= 0x2600 && codePoint <= 0x26FF) ||   // Misc symbols
      (codePoint >= 0x2700 && codePoint <= 0x27BF) ||   // Dingbats
      (codePoint >= 0xFE00 && codePoint <= 0xFE0F) ||   // Variation Selectors
      (codePoint >= 0x1F900 && codePoint <= 0x1F9FF) || // Supplemental Symbols and Pictographs
      (codePoint >= 127000 && codePoint <= 127600) ||   // Various asian characters
      (codePoint >= 65024 && codePoint <= 65039) ||     // Variation selector
      (codePoint >= 9100 && codePoint <= 9300) ||       // Misc items
      (codePoint >= 8400 && codePoint <= 8447)) {       // Combining Diacritical Marks for Symbols
    return true;
  }
  return false;
}
