/**
 * Lightweight Operational Transform for collaborative editing
 */

/**
 * Lightweight Operational Transform for collaborative editing
 */

export interface TextOp {
  type: 'retain' | 'insert' | 'delete';
  n?: number; // length for retain/delete
  s?: string; // text for insert
}

export interface Operation {
  ops: TextOp[];
  author: string;
  id: string;
}
// Export aliases for backward compatibility

/**
 * Create retain operation
 */
export const retain = (n: number): TextOp => ({ type: 'retain', n });

/**
 * Create insert operation
 */
export const insert = (s: string): TextOp => ({ type: 'insert', s });

/**
 * Create delete operation
 */
export const del = (n: number): TextOp => ({ type: 'delete', n });

/**
 * Apply operation to text
 */
export const apply = (text: string, op: Operation): string => {
  let result = '';
  let i = 0;
  
  for (const o of op.ops) {
    if (o.type === 'retain') {
      result += text.slice(i, i + (o.n || 0));
      i += o.n || 0;
    } else if (o.type === 'insert') {
      result += o.s || '';
    } else if (o.type === 'delete') {
      i += o.n || 0;
    }
  }
  
  return result;
};

/**
 * Transform operation against another (simplified)
 */
export const transform = (op1: Operation, op2: Operation): Operation => {
  const result: TextOp[] = [];
  let i1 = 0, i2 = 0;
  let ops1 = op1.ops, ops2 = op2.ops;
  
  while (i1 < ops1.length || i2 < ops2.length) {
    if (i1 >= ops1.length) {
      result.push(...ops2.slice(i2));
      break;
    }
    if (i2 >= ops2.length) {
      result.push(...ops1.slice(i1));
      break;
    }
    
    const o1 = ops1[i1], o2 = ops2[i2];
    
    if (o1.type === 'insert') {
      result.push(retain(o1.s?.length || 0));
      i1++;
    } else if (o2.type === 'insert') {
      result.push(insert(o2.s || ''));
      i2++;
    } else {
      const len1 = o1.n || 0;
      const len2 = o2.n || 0;
      
      if (len1 === len2) {
        if (o1.type === 'retain' && o2.type === 'retain') {
          result.push(retain(len1));
        }
        i1++; i2++;
      } else if (len1 < len2) {
        if (o1.type === 'retain') result.push(retain(len1));
        ops2[i2] = { ...o2, n: len2 - len1 };
        i1++;
      } else {
        if (o2.type === 'retain') result.push(retain(len2));
        ops1[i1] = { ...o1, n: len1 - len2 };
        i2++;
      }
    }
  }
  
  return { ops: result, author: op1.author, id: op1.id };
};
export const applyOperation = apply;
export const transformOperation = transform;
/**
 * Create operation from text diff
 */
export const fromDiff = (oldText: string, newText: string, author: string): Operation => {
  const ops: TextOp[] = [];
  let i = 0, j = 0;
  
  // Simple diff algorithm
  while (i < oldText.length || j < newText.length) {
    if (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
      let len = 0;
      while (i + len < oldText.length && j + len < newText.length && 
             oldText[i + len] === newText[j + len]) {
        len++;
      }
      ops.push(retain(len));
      i += len;
      j += len;
    } else if (j < newText.length) {
      let text = '';
      while (j < newText.length && (i >= oldText.length || oldText[i] !== newText[j])) {
        text += newText[j];
        j++;
      }
      ops.push(insert(text));
    } else {
      let len = 0;
      while (i + len < oldText.length) {
        len++;
      }
      ops.push(del(len));
      i += len;
    }
  }
  
  return { ops, author, id: Date.now().toString() };
};

/**
 * Transform cursor position through operation
 */
export const transformCursor = (cursor: number, op: Operation): number => {
  let pos = cursor;
  let offset = 0;
  
  for (const o of op.ops) {
    if (o.type === 'retain') {
      offset += o.n || 0;
    } else if (o.type === 'insert') {
      if (offset <= pos) {
        pos += o.s?.length || 0;
      }
    } else if (o.type === 'delete') {
      if (offset < pos) {
        pos = Math.max(offset, pos - (o.n || 0));
      }
      offset += o.n || 0;
    }
  }
  
  return pos;
};

/**
 * Compose two operations
 */
export const compose = (op1: Operation, op2: Operation): Operation => {
  const ops: TextOp[] = [];
  let i1 = 0, i2 = 0;
  
  while (i1 < op1.ops.length || i2 < op2.ops.length) {
    if (i2 >= op2.ops.length) {
      ops.push(...op1.ops.slice(i1));
      break;
    }
    
    const o1 = op1.ops[i1];
    const o2 = op2.ops[i2];
    
    if (!o1) {
      ops.push(...op2.ops.slice(i2));
      break;
    }
    
    if (o1.type === 'delete') {
      ops.push(o1);
      i1++;
    } else if (o2.type === 'insert') {
      ops.push(o2);
      i2++;
    } else if (o1.type === 'retain' && o2.type === 'retain') {
      const len = Math.min(o1.n || 0, o2.n || 0);
      ops.push(retain(len));
      
      if ((o1.n || 0) > len) op1.ops[i1] = { ...o1, n: (o1.n || 0) - len };
      else i1++;
      
      if ((o2.n || 0) > len) op2.ops[i2] = { ...o2, n: (o2.n || 0) - len };
      else i2++;
    } else {
      i1++; i2++;
    }
  }
  
  return { ops, author: op2.author, id: op2.id };
};
