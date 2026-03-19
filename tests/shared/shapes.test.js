import { describe, it, expect, beforeEach } from 'vitest';
import { createMockContext } from '../helpers/mock-canvas.js';
import {
  drawCircle, strokeCircle,
  drawRect, strokeRect,
  drawTriangle, strokeTriangle,
  drawRoundedPoly, strokePoly,
  drawLine, drawEllipse,
  drawRegularPoly, drawStar,
  drawArrow, drawCheckmark, drawX
} from '../../src/shared/shapes.js';

describe('shapes', () => {
  let ctx;

  beforeEach(() => {
    ctx = createMockContext();
  });

  describe('drawCircle', () => {
    it('draws a filled circle', () => {
      drawCircle(ctx, 50, 50, 20, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0].style).toBe('#FF0000');
      // Path should contain an arc
      const path = fills[0].path;
      expect(path.some(p => p.type === 'arc')).toBe(true);
    });

    it('accepts color object with hex property', () => {
      drawCircle(ctx, 50, 50, 20, { hex: '#00FF00' });
      expect(ctx.getFills()[0].style).toBe('#00FF00');
    });
  });

  describe('strokeCircle', () => {
    it('draws a stroked circle', () => {
      strokeCircle(ctx, 50, 50, 20, '#0000FF', 3);
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].style).toBe('#0000FF');
      expect(strokes[0].lineWidth).toBe(3);
    });

    it('uses default lineWidth of 2', () => {
      strokeCircle(ctx, 50, 50, 20, '#0000FF');
      expect(ctx.getStrokes()[0].lineWidth).toBe(2);
    });
  });

  describe('drawRect', () => {
    it('draws a simple filled rectangle', () => {
      drawRect(ctx, 10, 20, 100, 50, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0]).toMatchObject({
        type: 'rect',
        x: 10, y: 20, width: 100, height: 50,
        style: '#FF0000'
      });
    });

    it('draws a rounded rectangle', () => {
      drawRect(ctx, 10, 20, 100, 50, '#FF0000', 10);
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0].style).toBe('#FF0000');
      // Rounded rect uses path, not fillRect
      expect(fills[0].type).toBeUndefined();
      const path = fills[0].path;
      expect(path.some(p => p.type === 'quadratic')).toBe(true);
    });

    it('clamps border radius to half the smallest dimension', () => {
      // Should not throw when radius is larger than dimensions
      drawRect(ctx, 0, 0, 10, 10, '#FF0000', 100);
      expect(ctx.getFills()).toHaveLength(1);
    });
  });

  describe('strokeRect', () => {
    it('draws a simple stroked rectangle', () => {
      strokeRect(ctx, 10, 20, 100, 50, '#FF0000');
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0]).toMatchObject({
        type: 'rect',
        x: 10, y: 20, width: 100, height: 50,
        style: '#FF0000',
        lineWidth: 2
      });
    });

    it('draws a rounded stroked rectangle', () => {
      strokeRect(ctx, 10, 20, 100, 50, '#FF0000', 10, 3);
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].lineWidth).toBe(3);
    });
  });

  describe('drawTriangle', () => {
    it('draws a filled triangle', () => {
      drawTriangle(ctx, 50, 50, 30, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0].style).toBe('#FF0000');
      // Should have move + 2 lines + close
      const path = fills[0].path;
      expect(path.filter(p => p.type === 'move')).toHaveLength(1);
      expect(path.filter(p => p.type === 'line')).toHaveLength(2);
    });

    it('rotates the triangle', () => {
      drawTriangle(ctx, 50, 50, 30, '#FF0000', Math.PI);
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
    });
  });

  describe('strokeTriangle', () => {
    it('draws a stroked triangle', () => {
      strokeTriangle(ctx, 50, 50, 30, '#0000FF', 0, 3);
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].lineWidth).toBe(3);
    });
  });

  describe('drawRoundedPoly', () => {
    it('draws a rounded polygon from points', () => {
      const points = [
        { x: 0, y: 0 }, { x: 100, y: 0 },
        { x: 100, y: 100 }, { x: 0, y: 100 }
      ];
      drawRoundedPoly(ctx, points, 10, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0].style).toBe('#FF0000');
    });

    it('handles 2 points as a line', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
      drawRoundedPoly(ctx, points, 10, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
    });

    it('handles < 2 points gracefully', () => {
      drawRoundedPoly(ctx, [{ x: 0, y: 0 }], 10, '#FF0000');
      expect(ctx.getFills()).toHaveLength(0);
    });
  });

  describe('strokePoly', () => {
    it('draws a stroked polygon', () => {
      const points = [
        { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }
      ];
      strokePoly(ctx, points, '#0000FF');
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].lineWidth).toBe(2);
    });

    it('handles < 2 points gracefully', () => {
      strokePoly(ctx, [{ x: 0, y: 0 }], '#0000FF');
      expect(ctx.getStrokes()).toHaveLength(0);
    });
  });

  describe('drawLine', () => {
    it('draws a line between two points', () => {
      drawLine(ctx, 0, 0, 100, 100, '#FF0000', 3);
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].style).toBe('#FF0000');
      expect(strokes[0].lineWidth).toBe(3);
      const path = strokes[0].path;
      expect(path[0]).toMatchObject({ type: 'move', x: 0, y: 0 });
      expect(path[1]).toMatchObject({ type: 'line', x: 100, y: 100 });
    });

    it('uses default lineWidth of 2', () => {
      drawLine(ctx, 0, 0, 100, 100, '#FF0000');
      expect(ctx.getStrokes()[0].lineWidth).toBe(2);
    });
  });

  describe('drawEllipse', () => {
    it('draws a filled ellipse', () => {
      drawEllipse(ctx, 50, 50, 40, 20, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0].style).toBe('#FF0000');
      const path = fills[0].path;
      expect(path.some(p => p.type === 'ellipse')).toBe(true);
    });

    it('accepts rotation', () => {
      drawEllipse(ctx, 50, 50, 40, 20, '#FF0000', Math.PI / 4);
      expect(ctx.getFills()).toHaveLength(1);
    });
  });

  describe('drawRegularPoly', () => {
    it('draws a hexagon (6 sides)', () => {
      drawRegularPoly(ctx, 50, 50, 30, 6, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      // Should have 1 move + 5 lines + close
      const path = fills[0].path;
      expect(path.filter(p => p.type === 'move')).toHaveLength(1);
      expect(path.filter(p => p.type === 'line')).toHaveLength(5);
    });

    it('draws a pentagon (5 sides)', () => {
      drawRegularPoly(ctx, 50, 50, 30, 5, '#00FF00');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
    });
  });

  describe('drawStar', () => {
    it('draws a 5-pointed star', () => {
      drawStar(ctx, 50, 50, 30, 15, 5, '#FF0000');
      const fills = ctx.getFills();
      expect(fills).toHaveLength(1);
      expect(fills[0].style).toBe('#FF0000');
      // 5-point star has 10 vertices (5 outer + 5 inner)
      const path = fills[0].path;
      expect(path.filter(p => p.type === 'move')).toHaveLength(1);
      expect(path.filter(p => p.type === 'line')).toHaveLength(9);
    });
  });

  describe('drawArrow', () => {
    it('draws an arrow (line + head)', () => {
      drawArrow(ctx, 0, 0, 100, 0, '#FF0000', 2, 10);
      // Should produce 2 strokes: line + arrowhead
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(2);
    });
  });

  describe('drawCheckmark', () => {
    it('draws a checkmark', () => {
      drawCheckmark(ctx, 50, 50, 30, '#00FF00');
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].style).toBe('#00FF00');
      // Resets lineCap to 'butt' after drawing
      expect(ctx.lineCap).toBe('butt');
    });
  });

  describe('drawX', () => {
    it('draws an X shape', () => {
      drawX(ctx, 50, 50, 30, '#FF0000');
      const strokes = ctx.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes[0].style).toBe('#FF0000');
      // Resets lineCap to 'butt' after drawing
      expect(ctx.lineCap).toBe('butt');
    });
  });
});
