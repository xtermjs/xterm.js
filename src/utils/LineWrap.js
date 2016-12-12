export function padLine (line, x, defAttr) {
  var ch = [defAttr, ' ', 1, 'pad']; // does xterm use the default attr?
  while (line.length <= x) {
    line.push(ch)
  }
  return line
}

export function unpadLine (line) {
  return line.filter(c => !c[3] || c[3] !== 'pad')
}

export function wrapLines (unwrappedLine, x, defAttr) {
  return unwrappedLine.reduce((memo, e, index) => {
    if (memo.length === 0) {
      memo.push([])
    }
    if (memo[memo.length - 1].length >= x) {
      memo.push([])
    }
    if (index !== unwrappedLine.length - 1 || index === unwrappedLine.length - 1 && e[1] !== ' ') {
      memo[memo.length - 1].push(e)
    }
    return memo
  }, [])
  .map((wrappedLine, index) => {
    var line = index === 0
      ? wrappedLine
      : wrappedLine.map(c => c[3] ? c : c.concat('wrapped'))
    return padLine(line, x, defAttr)
  })
  .filter(l => l.some(c => c[1] !== ' '))
}

export function removeWrappingFlags (line) {
  return line
    .filter(c => !c[3] || c[3] !== 'pad')
    .map(c => [c[0], c[1], c[2]])
}

export function lastNonBlankLine (lines) {
  return lines.reduce((memo, line, index) => {
    if (!memo) return index
    if (lines[index].every(c => c[1] === ' ')) return memo
    return index
  }, null)
}
