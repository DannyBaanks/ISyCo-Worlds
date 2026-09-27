/** Incrementally reveals only the JSON proposal's user-facing `reply` string. */
export class WorldHelperReplyDecoder {
  private stage: 'before-root' | 'root-key' | 'after-key' | 'root-value' | 'reply-value' | 'nested' | 'after-root' = 'before-root';
  private stringMode: 'key' | 'ignore' | 'reply' | null = null;
  private keyRaw = '';
  private keyEscape = false;
  private ignoreEscape = false;
  private replyEscape = false;
  private unicodeDigits = '';
  private nesting: Array<'{' | '['> = [];
  private replyFound = false;
  private replyClosed = false;

  push(rawDelta: string): string {
    if (typeof rawDelta !== 'string') throw new TypeError('Provider delta must be text');
    let output = '';
    for (const char of rawDelta) {
      if (this.stringMode === 'key') {
        this.keyRaw += char;
        if (this.keyEscape) this.keyEscape = false;
        else if (char === '\\') this.keyEscape = true;
        else if (char === '"') {
          let key: unknown;
          try { key = JSON.parse(this.keyRaw); }
          catch { throw new Error('Malformed JSON property name'); }
          if (typeof key !== 'string') throw new Error('Malformed JSON property name');
          this.keyRaw = '';
          this.stringMode = null;
          this.stage = 'after-key';
          this.pendingKeyIsReply = key === 'reply';
        }
        continue;
      }

      if (this.stringMode === 'ignore') {
        if (this.ignoreEscape) this.ignoreEscape = false;
        else if (char === '\\') this.ignoreEscape = true;
        else if (char === '"') this.stringMode = null;
        continue;
      }

      if (this.stringMode === 'reply') {
        if (this.unicodeDigits.length > 0) {
          if (!/[0-9a-f]/i.test(char)) throw new Error('Malformed Unicode escape in reply');
          this.unicodeDigits += char;
          if (this.unicodeDigits.length === 4) {
            output += String.fromCharCode(Number.parseInt(this.unicodeDigits, 16));
            this.unicodeDigits = '';
            this.expectUnicodeDigits = false;
          }
          continue;
        }
        if (this.replyEscape) {
          this.replyEscape = false;
          if (char === 'u') { this.unicodeDigits = ''; this.expectUnicodeDigits = true; continue; }
          const escaped: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
          if (!(char in escaped)) throw new Error('Malformed escape in reply');
          output += escaped[char];
          continue;
        }
        if (this.expectUnicodeDigits) {
          if (!/[0-9a-f]/i.test(char)) throw new Error('Malformed Unicode escape in reply');
          this.unicodeDigits += char;
          if (this.unicodeDigits.length === 4) {
            output += String.fromCharCode(Number.parseInt(this.unicodeDigits, 16));
            this.unicodeDigits = '';
            this.expectUnicodeDigits = false;
          }
          continue;
        }
        if (char === '\\') this.replyEscape = true;
        else if (char === '"') { this.stringMode = null; this.replyClosed = true; this.stage = 'root-value'; }
        else {
          if (char.charCodeAt(0) < 0x20) throw new Error('Control character in reply string');
          output += char;
        }
        continue;
      }

      if (this.stage === 'before-root') {
        if (/\s/.test(char)) continue;
        if (char !== '{') throw new Error('Proposal must be a JSON object');
        this.stage = 'root-key';
        continue;
      }
      if (this.stage === 'after-root') {
        if (!/\s/.test(char)) throw new Error('Unexpected content after proposal object');
        continue;
      }
      if (this.stage === 'root-key') {
        if (/\s/.test(char)) continue;
        if (char === '}' ) { this.stage = 'after-root'; continue; }
        if (char !== '"') throw new Error('Expected proposal property name');
        this.keyRaw = '"';
        this.keyEscape = false;
        this.stringMode = 'key';
        continue;
      }
      if (this.stage === 'after-key') {
        if (/\s/.test(char)) continue;
        if (char !== ':') throw new Error('Expected colon after proposal property');
        this.stage = this.pendingKeyIsReply ? 'reply-value' : 'root-value';
        this.pendingKeyIsReply = false;
        continue;
      }
      if (this.stage === 'reply-value') {
        if (/\s/.test(char)) continue;
        if (char !== '"') throw new Error('Proposal reply must be a JSON string');
        this.replyFound = true;
        this.replyClosed = false;
        this.stringMode = 'reply';
        this.replyEscape = false;
        this.expectUnicodeDigits = false;
        continue;
      }
      if (this.stage === 'root-value') {
        if (/\s/.test(char)) continue;
        if (char === ',') { this.stage = 'root-key'; continue; }
        if (char === '}') { this.stage = 'after-root'; continue; }
        if (char === '"') { this.stringMode = 'ignore'; this.ignoreEscape = false; continue; }
        if (char === '{' || char === '[') {
          this.nesting = [char];
          this.stage = 'nested';
        }
        continue;
      }
      if (this.stage === 'nested') {
        if (char === '"') { this.stringMode = 'ignore'; this.ignoreEscape = false; continue; }
        if (char === '{' || char === '[') this.nesting.push(char);
        else if (char === '}' || char === ']') {
          const opening = this.nesting.pop();
          if (!opening || (opening === '{' && char !== '}') || (opening === '[' && char !== ']')) throw new Error('Malformed nested proposal value');
          if (this.nesting.length === 0) this.stage = 'root-value';
        }
      }
    }
    return output;
  }

  private pendingKeyIsReply = false;
  private expectUnicodeDigits = false;

  finish(): void {
    if (!this.replyFound) throw new Error('Proposal has no top-level reply field');
    if (!this.replyClosed || this.stringMode === 'reply' || this.expectUnicodeDigits || this.unicodeDigits.length > 0 || this.replyEscape) {
      throw new Error('Truncated or unterminated reply string');
    }
    if (this.stringMode !== null || this.stage !== 'after-root') throw new Error('Truncated proposal JSON');
  }
}
