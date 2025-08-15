import { Vector2, type Vector3 } from '@babylonjs/core';
import type { BSPNode, DoomLineDef, DoomSector } from './doom-geometry';

/**
 * BSP (Binary Space Partitioning) Tree implementation for DOOM-like geometry culling
 * Optimized for front-to-back rendering and visibility determination
 */

export interface PartitionResult {
  frontLines: DoomLineDef[];
  backLines: DoomLineDef[];
  splitLine: DoomLineDef;
}

export interface BSPTraversalResult {
  visibleSectors: DoomSector[];
  visibleLines: DoomLineDef[];
  renderOrder: number[];
}

export class BSPTree {
  private root: BSPNode | null = null;
  private allLines: DoomLineDef[] = [];

  constructor(sectors: DoomSector[]) {
    this.allLines = sectors.flatMap((sector) => sector.lineDefs);
    this.root = this.buildTree(this.allLines, sectors);
  }

  /**
   * Builds the BSP tree recursively using line-based partitioning
   */
  public buildTree(lines: DoomLineDef[], sectors: DoomSector[], depth = 0): BSPNode | null {
    if (lines.length === 0) {
      return null;
    }

    // Leaf node condition: small number of lines or max depth reached
    if (lines.length <= 4 || depth > 20) {
      return {
        id: `leaf_${depth}_${lines.length}`,
        isLeaf: true,
        sectors: sectors.filter((sector) => sector.lineDefs.some((line) => lines.includes(line))),
      };
    }

    // Select best partition line using heuristic
    const partitionLine = this.selectPartitionLine(lines);
    if (!partitionLine) {
      // Fallback to leaf if no good partition found
      return {
        id: `leaf_fallback_${depth}`,
        isLeaf: true,
        sectors: sectors,
      };
    }

    // Partition lines using the selected line
    const partition = this.partitionLines(lines, partitionLine);

    // Recursively build front and back subtrees
    const frontChild = this.buildTree(partition.frontLines, sectors, depth + 1);
    const backChild = this.buildTree(partition.backLines, sectors, depth + 1);

    const node: BSPNode = {
      id: `node_${depth}_${partitionLine.id}`,
      isLeaf: false,
      splitLine: partitionLine,
    };

    if (frontChild) {
      node.frontChild = frontChild;
    }

    if (backChild) {
      node.backChild = backChild;
    }

    return node;
  }

  /**
   * Selects the best line for partitioning using a simple heuristic
   * Prioritizes lines that create balanced splits
   */
  private selectPartitionLine(lines: DoomLineDef[]): DoomLineDef | null {
    if (lines.length === 0) return null;

    let bestLine: DoomLineDef | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const line of lines) {
      const partition = this.partitionLines(lines, line);

      // Heuristic: prefer balanced splits, minimize splits
      const balance = Math.abs(partition.frontLines.length - partition.backLines.length);
      const splits = this.countLineSplits(lines, line);

      // Score: favor balance, penalize splits
      const score = 100 - balance - splits * 10;

      if (score > bestScore) {
        bestScore = score;
        bestLine = line;
      }
    }

    return bestLine;
  }

  /**
   * Partitions lines into front and back sets relative to a partition line
   */
  private partitionLines(lines: DoomLineDef[], partitionLine: DoomLineDef): PartitionResult {
    const frontLines: DoomLineDef[] = [];
    const backLines: DoomLineDef[] = [];

    for (const line of lines) {
      if (line === partitionLine) {
        continue; // Skip the partition line itself
      }

      const classification = this.classifyLineRelativeToPartition(line, partitionLine);

      switch (classification) {
        case 'front':
          frontLines.push(line);
          break;
        case 'back':
          backLines.push(line);
          break;
        case 'colinear':
          // Colinear lines go to both sides for safety
          frontLines.push(line);
          backLines.push(line);
          break;
        case 'spanning':
          // For now, spanning lines go to both sides
          // TODO: Implement actual line splitting for better accuracy
          frontLines.push(line);
          backLines.push(line);
          break;
      }
    }

    return {
      frontLines,
      backLines,
      splitLine: partitionLine,
    };
  }

  /**
   * Classifies a line relative to a partition line
   */
  private classifyLineRelativeToPartition(
    line: DoomLineDef,
    partition: DoomLineDef
  ): 'front' | 'back' | 'colinear' | 'spanning' {
    const startSide = this.classifyPointRelativeToLine(line.startVertex.position, partition);
    const endSide = this.classifyPointRelativeToLine(line.endVertex.position, partition);

    if (startSide === 0 && endSide === 0) {
      return 'colinear';
    }

    if (startSide > 0 && endSide > 0) {
      return 'front';
    }

    if (startSide < 0 && endSide < 0) {
      return 'back';
    }

    return 'spanning'; // Line crosses the partition
  }

  /**
   * Classifies a point relative to a line
   * Returns: > 0 for front, < 0 for back, 0 for on line
   */
  private classifyPointRelativeToLine(point: Vector2, line: DoomLineDef): number {
    const dx = line.endVertex.position.x - line.startVertex.position.x;
    const dy = line.endVertex.position.y - line.startVertex.position.y;
    const px = point.x - line.startVertex.position.x;
    const py = point.y - line.startVertex.position.y;

    // Cross product: positive = left/front, negative = right/back
    return dx * py - dy * px;
  }

  /**
   * Counts how many lines would be split by using the given partition line
   */
  private countLineSplits(lines: DoomLineDef[], partitionLine: DoomLineDef): number {
    let splits = 0;

    for (const line of lines) {
      if (line === partitionLine) continue;

      if (this.classifyLineRelativeToPartition(line, partitionLine) === 'spanning') {
        splits++;
      }
    }

    return splits;
  }

  /**
   * Traverses the BSP tree from a given viewpoint in front-to-back order
   * Returns sectors and lines that should be rendered
   */
  public traverseTree(viewpoint: Vector3): BSPTraversalResult {
    const result: BSPTraversalResult = {
      visibleSectors: [],
      visibleLines: [],
      renderOrder: [],
    };

    if (!this.root) {
      return result;
    }

    this.traverseNode(this.root, viewpoint, result);
    return result;
  }

  /**
   * Recursively traverses a BSP node
   */
  private traverseNode(node: BSPNode, viewpoint: Vector3, result: BSPTraversalResult): void {
    if (node.isLeaf) {
      // Leaf node: add all sectors to render list
      if (node.sectors) {
        result.visibleSectors.push(...node.sectors);
        for (const sector of node.sectors) {
          result.visibleLines.push(...sector.lineDefs);
        }
      }
      return;
    }

    if (!node.splitLine) {
      return; // Invalid node
    }

    // Determine which side of the partition the viewpoint is on
    const viewpoint2D = new Vector2(viewpoint.x, viewpoint.z);
    const side = this.classifyPointRelativeToLine(viewpoint2D, node.splitLine);

    if (side >= 0) {
      // Viewpoint is on front side: render back first, then front
      if (node.backChild) {
        this.traverseNode(node.backChild, viewpoint, result);
      }
      if (node.frontChild) {
        this.traverseNode(node.frontChild, viewpoint, result);
      }
    } else {
      // Viewpoint is on back side: render front first, then back
      if (node.frontChild) {
        this.traverseNode(node.frontChild, viewpoint, result);
      }
      if (node.backChild) {
        this.traverseNode(node.backChild, viewpoint, result);
      }
    }
  }

  /**
   * Checks if a point is visible from the viewpoint using BSP traversal
   */
  public isVisible(point: Vector3, viewpoint: Vector3): boolean {
    if (!this.root) {
      return true; // No BSP tree = everything visible
    }

    return this.isPointVisibleFromNode(this.root, point, viewpoint);
  }

  /**
   * Recursively checks visibility through BSP nodes
   */
  private isPointVisibleFromNode(node: BSPNode, point: Vector3, viewpoint: Vector3): boolean {
    if (node.isLeaf) {
      return true; // In same leaf = visible
    }

    if (!node.splitLine) {
      return true; // Invalid node = assume visible
    }

    const point2D = new Vector2(point.x, point.z);
    const viewpoint2D = new Vector2(viewpoint.x, viewpoint.z);

    const pointSide = this.classifyPointRelativeToLine(point2D, node.splitLine);
    const viewerSide = this.classifyPointRelativeToLine(viewpoint2D, node.splitLine);

    // If both points are on the same side, check that subtree
    if ((pointSide >= 0 && viewerSide >= 0) || (pointSide < 0 && viewerSide < 0)) {
      const childNode = pointSide >= 0 ? node.frontChild : node.backChild;
      return childNode ? this.isPointVisibleFromNode(childNode, point, viewpoint) : true;
    }

    // Points are on different sides - need line of sight check
    // For now, return true (basic implementation)
    // TODO: Implement proper line-of-sight test through partition
    return true;
  }

  /**
   * Returns the root node of the BSP tree
   */
  public getRoot(): BSPNode | null {
    return this.root;
  }

  /**
   * Returns statistics about the BSP tree
   */
  public getStats(): { nodes: number; leafs: number; maxDepth: number } {
    if (!this.root) {
      return { nodes: 0, leafs: 0, maxDepth: 0 };
    }

    let nodeCount = 0;
    let leafCount = 0;
    let maxDepth = 0;

    const traverse = (node: BSPNode, depth: number): void => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);

      if (node.isLeaf) {
        leafCount++;
      } else {
        if (node.frontChild) traverse(node.frontChild, depth + 1);
        if (node.backChild) traverse(node.backChild, depth + 1);
      }
    };

    traverse(this.root, 0);

    return { nodes: nodeCount, leafs: leafCount, maxDepth };
  }
}
