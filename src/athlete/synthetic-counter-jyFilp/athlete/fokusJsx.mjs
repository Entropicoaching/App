// Small hermetic JSX adapter for synthetic tests. No build, DOM or package dependency.
// It preserves JS expressions and handler bodies, and translates only JSX syntax.
export function jsx(source) {
  let i = 0
  const fail = message => { throw new SyntaxError(`${message} at ${i}`) }
  function quoted() {
    const start = i, quote = source[i++]
    while (i < source.length) {
      if (source[i] === '\\') { i += 2; continue }
      if (source[i++] === quote) return source.slice(start, i)
    }
    fail('Unterminated string')
  }
  function comment() {
    const start = i
    if (source[i + 1] === '/') {
      i = source.indexOf('\n', i)
      if (i < 0) i = source.length
    } else {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) fail('Unterminated comment')
      i = end + 2
    }
    return source.slice(start, i)
  }
  function code(braced = false) {
    let out = ''
    while (i < source.length) {
      const c = source[i]
      if (braced && c === '}') { i++; return out }
      if ('\'"`'.includes(c)) { out += quoted(); continue }
      if (c === '/' && ['/','*'].includes(source[i + 1])) { out += comment(); continue }
      if (c === '{') { i++; out += '{' + code(true) + '}'; continue }
      if (c === '<' && /[A-Za-z>]/.test(source[i + 1] || '')) { out += element(); continue }
      out += source[i++]
    }
    if (braced) fail('Unterminated expression')
    return out
  }
  const space = () => { while (/\s/.test(source[i] || '') && i < source.length) i++ }
  function name() {
    const start = i
    while (/[\w.$:-]/.test(source[i] || '') && i < source.length) i++
    if (start === i) fail('Expected name')
    return source.slice(start, i)
  }
  const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos|#39|#160);/g, e => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#160;':'\u00a0'})[e])
  function childText(raw) {
    const lines = raw.replace(/\r/g, '').split('\n')
    let last = -1
    lines.forEach((line, n) => { if (/\S/.test(line)) last = n })
    return decode(lines.map((line, n) => {
      let text = line.replace(/\t/g, ' ')
      if (n > 0) text = text.replace(/^ +/, '')
      if (n < lines.length - 1) text = text.replace(/ +$/, '')
      if (text && n < last) text += ' '
      return text
    }).join(''))
  }
  function element() {
    i++
    const tag = source[i] === '>' ? '' : name()
    const props = []
    let selfClosing = false
    while (i < source.length) {
      space()
      if (source.startsWith('/>', i)) { i += 2; selfClosing = true; break }
      if (source[i] === '>') { i++; break }
      if (source[i] === '{') { i++; props.push(code(true)); continue }
      const key = name()
      space()
      let value = 'true'
      if (source[i] === '=') {
        i++; space()
        if (source[i] === '{') { i++; value = code(true) }
        else if ('\'"'.includes(source[i])) value = JSON.stringify(decode(quoted().slice(1, -1)))
        else fail('Expected attribute value')
      }
      props.push(JSON.stringify(key) + ':' + value)
    }
    const children = []
    if (!selfClosing) {
      while (i < source.length) {
        if (source.startsWith('</', i)) {
          i += 2
          const close = source[i] === '>' ? '' : name()
          if (close !== tag || source[i++] !== '>') fail('Closing tag mismatch')
          break
        }
        if (source[i] === '<') { children.push(element()); continue }
        if (source[i] === '{') {
          i++
          const value = code(true)
          if (value.replace(/\/\*[\s\S]*?\*\//g, '').trim()) children.push('(' + value + ')')
          continue
        }
        const start = i
        while (i < source.length && !'<{'.includes(source[i])) i++
        const value = childText(source.slice(start, i))
        if (value) children.push(JSON.stringify(value))
      }
    }
    const type = !tag ? 'null' : /^[a-z]/.test(tag) ? JSON.stringify(tag) : tag
    return `__h(${type},{${props.join(',')}},${JSON.stringify(null)}${children.length ? ',' + children.join(',') : ''})`
  }
  return code()
}
