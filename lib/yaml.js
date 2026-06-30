// Minimal YAML parser for TreeJSON.
// Supports: block mappings, block sequences, flow mappings/sequences,
// scalars (strings, numbers, booleans, null), multi-line strings (| and >),
// quoted strings, comments. Not a complete YAML 1.2 implementation.
(() => {
  function parse(input) {
    if (input == null) return null;
    const text = String(input).replace(/\r\n?/g, '\n');
    const lines = preprocess(text);
    const parser = new BlockParser(lines);
    const result = parser.parseBlock(0);
    return result;
  }

  function preprocess(text) {
    const rawLines = text.split('\n');
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i];
      // Strip comments but preserve those inside quotes/flow.
      const stripped = stripComment(raw);
      if (stripped.trim() === '') continue;
      const indent = raw.match(/^\s*/)[0].length;
      lines.push({ indent, text: stripped.trimEnd(), raw });
    }
    return lines;
  }

  function stripComment(line) {
    let inSingle = false, inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '#' && !inSingle && !inDouble) {
        if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
      }
    }
    return line;
  }

  class BlockParser {
    constructor(lines) {
      this.lines = lines;
      this.i = 0;
    }

    parseBlock(indent) {
      if (this.i >= this.lines.length) return null;
      const first = this.lines[this.i];
      if (first.indent < indent) return null;

      const baseIndent = first.indent;
      const trimmed = first.text.trim();

      if (trimmed.startsWith('- ') || trimmed === '-') {
        return this.parseSequence(baseIndent);
      }
      // Mapping detection: look for unquoted key followed by ":".
      if (this.looksLikeMapping(first.text)) {
        return this.parseMapping(baseIndent);
      }
      // Scalar
      this.i++;
      return parseScalar(trimmed);
    }

    looksLikeMapping(text) {
      let inSingle = false, inDouble = false, depth = 0;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"' && !inSingle) inDouble = !inDouble;
        else if (c === "'" && !inDouble) inSingle = !inSingle;
        else if (!inSingle && !inDouble) {
          if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') depth--;
          else if (c === ':' && depth === 0) {
            const next = text[i + 1];
            if (next === undefined || next === ' ' || next === '\t') return true;
          }
        }
      }
      return false;
    }

    parseMapping(indent) {
      const obj = {};
      while (this.i < this.lines.length) {
        const line = this.lines[this.i];
        if (line.indent < indent) break;
        if (line.indent > indent) {
          // Should not happen for the first iteration; skip
          this.i++;
          continue;
        }
        const text = line.text.trim();
        if (text.startsWith('- ') || text === '-') break;
        const colonIdx = findColon(text);
        if (colonIdx === -1) {
          // Not a mapping line at this indent, stop
          break;
        }
        const key = unquote(text.slice(0, colonIdx).trim());
        const rest = text.slice(colonIdx + 1).trim();
        this.i++;
        if (rest === '' || rest === '|' || rest === '>' || /^[|>][-+]?$/.test(rest)) {
          if (rest.startsWith('|') || rest.startsWith('>')) {
            obj[key] = this.parseBlockScalar(rest, indent);
          } else if (this.i < this.lines.length && this.lines[this.i].indent > indent) {
            obj[key] = this.parseBlock(this.lines[this.i].indent);
          } else {
            obj[key] = null;
          }
        } else if (rest.startsWith('{') || rest.startsWith('[')) {
          obj[key] = parseFlow(rest);
        } else {
          obj[key] = parseScalar(rest);
        }
      }
      return obj;
    }

    parseSequence(indent) {
      const arr = [];
      while (this.i < this.lines.length) {
        const line = this.lines[this.i];
        if (line.indent < indent) break;
        if (line.indent > indent) {
          this.i++;
          continue;
        }
        const text = line.text.trim();
        if (!text.startsWith('-')) break;
        const after = text.slice(1).replace(/^\s+/, '');
        this.i++;
        if (after === '') {
          if (this.i < this.lines.length && this.lines[this.i].indent > indent) {
            arr.push(this.parseBlock(this.lines[this.i].indent));
          } else {
            arr.push(null);
          }
        } else if (after.startsWith('{') || after.startsWith('[')) {
          arr.push(parseFlow(after));
        } else if (this.looksLikeMapping(after)) {
          // Inline mapping start: "- key: value"
          // Treat the rest of this and following deeper lines as a mapping.
          // Inject a synthetic line for the mapping start.
          const synthIndent = indent + 2;
          this.lines.splice(this.i, 0, { indent: synthIndent, text: after, raw: after });
          arr.push(this.parseMapping(synthIndent));
        } else {
          arr.push(parseScalar(after));
        }
      }
      return arr;
    }

    parseBlockScalar(header, indent) {
      const style = header[0]; // | or >
      const chomp = header.slice(1); // '', '-', '+'
      const lines = [];
      let blockIndent = null;
      while (this.i < this.lines.length) {
        const ln = this.lines[this.i];
        if (ln.indent <= indent) break;
        if (blockIndent === null) blockIndent = ln.indent;
        const content = ln.raw.slice(blockIndent);
        lines.push(content);
        this.i++;
      }
      let result;
      if (style === '|') {
        result = lines.join('\n');
      } else {
        // folded
        result = lines.reduce((acc, ln, idx) => {
          if (idx === 0) return ln;
          if (ln === '' || acc.endsWith('\n')) return acc + '\n' + ln;
          if (/^\s/.test(ln)) return acc + '\n' + ln;
          return acc + ' ' + ln;
        }, '');
      }
      if (chomp === '-') result = result.replace(/\n+$/, '');
      else if (chomp !== '+') result = result.replace(/\n+$/, '') + '\n';
      return result;
    }
  }

  function findColon(text) {
    let inSingle = false, inDouble = false, depth = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (!inSingle && !inDouble) {
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') depth--;
        else if (c === ':' && depth === 0) {
          const next = text[i + 1];
          if (next === undefined || next === ' ' || next === '\t') return i;
        }
      }
    }
    return -1;
  }

  function unquote(s) {
    if (s.length >= 2) {
      const first = s[0], last = s[s.length - 1];
      if (first === '"' && last === '"') {
        return s.slice(1, -1).replace(/\\(.)/g, (_, c) => {
          if (c === 'n') return '\n';
          if (c === 't') return '\t';
          if (c === 'r') return '\r';
          return c;
        });
      }
      if (first === "'" && last === "'") {
        return s.slice(1, -1).replace(/''/g, "'");
      }
    }
    return s;
  }

  function parseScalar(text) {
    const s = text.trim();
    if (s === '' || s === '~' || /^null$/i.test(s)) return null;
    if (/^true$/i.test(s)) return true;
    if (/^false$/i.test(s)) return false;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d*\.\d+([eE][+-]?\d+)?$/.test(s) || /^-?\d+[eE][+-]?\d+$/.test(s)) return parseFloat(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return unquote(s);
    return s;
  }

  function parseFlow(text) {
    const parser = new FlowParser(text);
    return parser.parseValue();
  }

  class FlowParser {
    constructor(text) {
      this.text = text;
      this.pos = 0;
    }
    peek() { return this.text[this.pos]; }
    skipWs() { while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos++; }
    parseValue() {
      this.skipWs();
      const c = this.peek();
      if (c === '{') return this.parseMap();
      if (c === '[') return this.parseList();
      if (c === '"' || c === "'") return this.parseQuotedString(c);
      return this.parseScalar();
    }
    parseMap() {
      const obj = {};
      this.pos++; // {
      this.skipWs();
      if (this.peek() === '}') { this.pos++; return obj; }
      while (this.pos < this.text.length) {
        this.skipWs();
        const key = this.parseKey();
        this.skipWs();
        if (this.peek() === ':') this.pos++;
        this.skipWs();
        const val = this.parseValue();
        obj[key] = val;
        this.skipWs();
        if (this.peek() === ',') { this.pos++; continue; }
        if (this.peek() === '}') { this.pos++; break; }
        break;
      }
      return obj;
    }
    parseList() {
      const arr = [];
      this.pos++; // [
      this.skipWs();
      if (this.peek() === ']') { this.pos++; return arr; }
      while (this.pos < this.text.length) {
        this.skipWs();
        const val = this.parseValue();
        arr.push(val);
        this.skipWs();
        if (this.peek() === ',') { this.pos++; continue; }
        if (this.peek() === ']') { this.pos++; break; }
        break;
      }
      return arr;
    }
    parseKey() {
      const c = this.peek();
      if (c === '"' || c === "'") return this.parseQuotedString(c);
      let start = this.pos;
      while (this.pos < this.text.length && !/[:,}\]]/.test(this.text[this.pos])) this.pos++;
      return this.text.slice(start, this.pos).trim();
    }
    parseQuotedString(quote) {
      this.pos++;
      let out = '';
      while (this.pos < this.text.length) {
        const c = this.text[this.pos++];
        if (c === '\\' && quote === '"') {
          const next = this.text[this.pos++];
          if (next === 'n') out += '\n';
          else if (next === 't') out += '\t';
          else out += next;
        } else if (c === quote) {
          if (quote === "'" && this.text[this.pos] === "'") {
            out += "'"; this.pos++;
          } else {
            return out;
          }
        } else {
          out += c;
        }
      }
      return out;
    }
    parseScalar() {
      let start = this.pos;
      while (this.pos < this.text.length && !/[,}\]]/.test(this.text[this.pos])) this.pos++;
      return parseScalar(this.text.slice(start, this.pos).trim());
    }
  }

  window.YAML = { parse };
})();
