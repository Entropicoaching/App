// Local syntax adapter for the copied ForsideView only. No compiler or build.
export function offJsx(source) {
  let at = 0
  const peek = () => source[at]
  const match = value => source.startsWith(value, at)
  const skip = () => { while (at < source.length && /\s/.test(peek())) at++ }
  function token(pattern) {
    const start = at
    while (at < source.length && pattern.test(peek())) at++
    if (start === at) throw Error('Expected JSX token at ' + at)
    return source.slice(start, at)
  }
  function string() {
    const start = at, quote = source[at++]
    while (at < source.length) {
      if (source[at] === '\\') at += 2
      else if (source[at++] === quote) return source.slice(start, at)
    }
    throw Error('Unclosed quote')
  }
  function js(end = false) {
    let result = ''
    while (at < source.length) {
      if (peek() === '}' && end) { at++; return result }
      if ('\'"`'.includes(peek())) { result += string(); continue }
      if (match('//') || match('/*')) {
        const start = at, block = match('/*')
        const stop = source.indexOf(block ? '*/' : '\n', at + 2)
        at = stop < 0 ? source.length : stop + (block ? 2 : 1)
        result += source.slice(start, at); continue
      }
      if (peek() === '{') { at++; result += '{' + js(true) + '}'; continue }
      if (peek() === '<' && /[A-Za-z>]/.test(source[at + 1] || '')) result += tag()
      else result += source[at++]
    }
    if (end) throw Error('Unclosed expression')
    return result
  }
  function tag() {
    at++
    const name = peek() === '>' ? '' : token(/[\w.:-]/)
    const props = [], children = []
    let closed = false
    for (;;) {
      skip()
      if (match('/>')) { at += 2; closed = true; break }
      if (peek() === '>') { at++; break }
      if (peek() === '{') { at++; props.push(js(true)); continue }
      const key = token(/[\w:-]/); skip()
      let value = 'true'
      if (peek() === '=') {
        at++; skip()
        if (peek() === '{') { at++; value = js(true) }
        else value = string()
      }
      props.push(JSON.stringify(key) + ':' + value)
    }
    while (!closed) {
      if (match('</')) {
        at += 2
        const close = peek() === '>' ? '' : token(/[\w.:-]/)
        if (close !== name || source[at++] !== '>') throw Error('Mismatched JSX tag')
        closed = true
      } else if (peek() === '<') children.push(tag())
      else if (peek() === '{') {
        at++
        const value = js(true)
        if (value.replace(/\/\*[\s\S]*?\*\//g, '').trim()) children.push('(' + value + ')')
      } else {
        const start = at
        while (at < source.length && !'<{'.includes(peek())) at++
        if (at === source.length) throw Error('Unclosed JSX tag')
        const value = source.slice(start, at).replace(/\s+/g, ' ').trim()
        if (value) children.push(JSON.stringify(value))
      }
    }
    const type = !name ? 'null' : /^[a-z]/.test(name) ? JSON.stringify(name) : name
    return `__offH(${type},{${props.join(',')}}${children.length ? ',' + children.join(',') : ''})`
  }
  return js()
}
