export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  authorId: string;
  timestamp: number;
}

export class OperationalTransform {
  /**
   * Transform operation A against operation B
   * Returns the transformed version of operation A
   */
  transform(opA: Operation, opB: Operation): Operation {
    // If operations are from the same author, no transformation needed
    if (opA.authorId === opB.authorId) {
      return opA;
    }

    const transformedOp = { ...opA };

    // Transform based on operation types
    if (opA.type === 'insert' && opB.type === 'insert') {
      transformedOp.position = this.transformInsertInsert(opA, opB);
    } else if (opA.type === 'insert' && opB.type === 'delete') {
      transformedOp.position = this.transformInsertDelete(opA, opB);
    } else if (opA.type === 'delete' && opB.type === 'insert') {
      const result = this.transformDeleteInsert(opA, opB);
      transformedOp.position = result.position;
      transformedOp.length = result.length;
    } else if (opA.type === 'delete' && opB.type === 'delete') {
      const result = this.transformDeleteDelete(opA, opB);
      transformedOp.position = result.position;
      transformedOp.length = result.length;
    }

    return transformedOp;
  }

  private transformInsertInsert(opA: Operation, opB: Operation): number {
    if (opA.position <= opB.position) {
      return opA.position;
    } else {
      return opA.position + (opB.content?.length || 0);
    }
  }

  private transformInsertDelete(opA: Operation, opB: Operation): number {
    const deleteEnd = opB.position + (opB.length || 0);
    
    if (opA.position <= opB.position) {
      return opA.position;
    } else if (opA.position >= deleteEnd) {
      return opA.position - (opB.length || 0);
    } else {
      // Insert position is within deleted range
      return opB.position;
    }
  }

  private transformDeleteInsert(opA: Operation, opB: Operation): { position: number; length: number } {
    const deleteEnd = opA.position + (opA.length || 0);
    
    if (opB.position <= opA.position) {
      return {
        position: opA.position + (opB.content?.length || 0),
        length: opA.length || 0
      };
    } else if (opB.position >= deleteEnd) {
      return {
        position: opA.position,
        length: opA.length || 0
      };
    } else {
      // Insert is within delete range - split the delete
      return {
        position: opA.position,
        length: (opA.length || 0) + (opB.content?.length || 0)
      };
    }
  }

  private transformDeleteDelete(opA: Operation, opB: Operation): { position: number; length: number } {
    const deleteAEnd = opA.position + (opA.length || 0);
    const deleteBEnd = opB.position + (opB.length || 0);

    if (deleteAEnd <= opB.position) {
      // A is completely before B
      return {
        position: opA.position,
        length: opA.length || 0
      };
    } else if (opA.position >= deleteBEnd) {
      // A is completely after B
      return {
        position: opA.position - (opB.length || 0),
        length: opA.length || 0
      };
    } else {
      // Overlapping deletes - need to handle intersection
      const overlapStart = Math.max(opA.position, opB.position);
      const overlapEnd = Math.min(deleteAEnd, deleteBEnd);
      const overlapLength = overlapEnd - overlapStart;

      return {
        position: Math.min(opA.position, opB.position),
        length: (opA.length || 0) - overlapLength
      };
    }
  }

  /**
   * Compose two operations into a single operation
   */
  compose(opA: Operation, opB: Operation): Operation[] {
    // This is a simplified composition - in practice, you'd need more complex logic
    // to handle all edge cases and maintain operation semantics
    
    if (opA.type === 'insert' && opB.type === 'delete') {
      // Check if delete cancels out the insert
      const insertEnd = opA.position + (opA.content?.length || 0);
      if (opB.position >= opA.position && (opB.position + (opB.length || 0)) <= insertEnd) {
        // Delete is within inserted text
        const beforeDelete = opA.content?.substring(0, opB.position - opA.position) || '';
        const afterDelete = opA.content?.substring(opB.position - opA.position + (opB.length || 0)) || '';
        
        return [{
          ...opA,
          content: beforeDelete + afterDelete
        }];
      }
    }

    // Default: return both operations
    return [opA, opB];
  }
}
