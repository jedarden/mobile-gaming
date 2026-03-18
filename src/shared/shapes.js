/**
 * Canvas 2D drawing primitives
 *
 * Reusable shape drawing functions for consistent rendering across games.
 * All coordinates and dimensions are in logical pixels.
 */

/**
 * Set the fill color on a context
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {string|Object} color - CSS color string or color object with hex property
 */
function setFillColor(ctx, color) {
  ctx.fillStyle = typeof color === 'string' ? color : color.hex || color;
}

/**
 * Set the stroke color on a context
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {string|Object} color - CSS color string or color object with hex property
 * @param {number} lineWidth - Stroke width in pixels (default: 1)
 */
function setStrokeColor(ctx, color, lineWidth = 1) {
  ctx.strokeStyle = typeof color === 'string' ? color : color.hex || color;
  ctx.lineWidth = lineWidth;
}

/**
 * Draw a filled circle
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position in logical pixels
 * @param {number} y - Center Y position in logical pixels
 * @param {number} radius - Circle radius in logical pixels
 * @param {string|Object} color - Fill color
 */
export function drawCircle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw a stroked circle
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position in logical pixels
 * @param {number} y - Center Y position in logical pixels
 * @param {number} radius - Circle radius in logical pixels
 * @param {string|Object} color - Stroke color
 * @param {number} lineWidth - Stroke width in pixels (default: 2)
 */
export function strokeCircle(ctx, x, y, radius, color, lineWidth = 2) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  setStrokeColor(ctx, color, lineWidth);
  ctx.stroke();
}

/**
 * Draw a filled rectangle with optional border radius
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - X position in logical pixels
 * @param {number} y - Y position in logical pixels
 * @param {number} width - Rectangle width in logical pixels
 * @param {number} height - Rectangle height in logical pixels
 * @param {string|Object} color - Fill color
 * @param {number} borderRadius - Border radius in pixels (default: 0)
 */
export function drawRect(ctx, x, y, width, height, color, borderRadius = 0) {
  if (borderRadius <= 0) {
    // Simple rectangle for no radius
    setFillColor(ctx, color);
    ctx.fillRect(x, y, width, height);
    return;
  }

  // Rounded rectangle
  const r = Math.min(borderRadius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw a stroked rectangle with optional border radius
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - X position in logical pixels
 * @param {number} y - Y position in logical pixels
 * @param {number} width - Rectangle width in logical pixels
 * @param {number} height - Rectangle height in logical pixels
 * @param {string|Object} color - Stroke color
 * @param {number} borderRadius - Border radius in pixels (default: 0)
 * @param {number} lineWidth - Stroke width in pixels (default: 2)
 */
export function strokeRect(ctx, x, y, width, height, color, borderRadius = 0, lineWidth = 2) {
  if (borderRadius <= 0) {
    // Simple rectangle for no radius
    setStrokeColor(ctx, color, lineWidth);
    ctx.strokeRect(x, y, width, height);
    return;
  }

  // Rounded rectangle
  const r = Math.min(borderRadius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  setStrokeColor(ctx, color, lineWidth);
  ctx.stroke();
}

/**
 * Draw a filled triangle
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position in logical pixels
 * @param {number} y - Center Y position in logical pixels
 * @param {number} size - Triangle size (distance from center to vertex)
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: 0, pointing up)
 */
export function drawTriangle(ctx, x, y, size, color, rotation = 0) {
  // Calculate vertices based on rotation (default: pointing up)
  const angles = [
    rotation - Math.PI / 2,      // Top
    rotation + Math.PI / 2 - Math.PI / 6,  // Bottom right
    rotation + Math.PI / 2 + Math.PI / 6   // Bottom left
  ];

  ctx.beginPath();
  angles.forEach((angle, i) => {
    const vx = x + Math.cos(angle) * size;
    const vy = y + Math.sin(angle) * size;
    if (i === 0) {
      ctx.moveTo(vx, vy);
    } else {
      ctx.lineTo(vx, vy);
    }
  });
  ctx.closePath();
  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw a stroked triangle
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position in logical pixels
 * @param {number} y - Center Y position in logical pixels
 * @param {number} size - Triangle size (distance from center to vertex)
 * @param {string|Object} color - Stroke color
 * @param {number} rotation - Rotation in radians (default: 0, pointing up)
 * @param {number} lineWidth - Stroke width in pixels (default: 2)
 */
export function strokeTriangle(ctx, x, y, size, color, rotation = 0, lineWidth = 2) {
  const angles = [
    rotation - Math.PI / 2,
    rotation + Math.PI / 2 - Math.PI / 6,
    rotation + Math.PI / 2 + Math.PI / 6
  ];

  ctx.beginPath();
  angles.forEach((angle, i) => {
    const vx = x + Math.cos(angle) * size;
    const vy = y + Math.sin(angle) * size;
    if (i === 0) {
      ctx.moveTo(vx, vy);
    } else {
      ctx.lineTo(vx, vy);
    }
  });
  ctx.closePath();
  setStrokeColor(ctx, color, lineWidth);
  ctx.stroke();
}

/**
 * Draw a rounded polygon (smoothed vertices)
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Array<{x: number, y: number}>} points - Array of vertex positions
 * @param {number} radius - Corner radius for smoothing
 * @param {string|Object} color - Fill color
 * @param {boolean} closed - Whether to close the path (default: true)
 */
export function drawRoundedPoly(ctx, points, radius, color, closed = true) {
  if (points.length < 2) return;

  ctx.beginPath();

  if (points.length === 2) {
    // Just a line
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    // Draw with rounded corners
    const len = points.length;
    for (let i = 0; i < len; i++) {
      const p0 = points[(i - 1 + len) % len];
      const p1 = points[i];
      const p2 = points[(i + 1) % len];

      if (i === 0) {
        // Start at the first point
        ctx.moveTo(p1.x, p1.y);
      } else {
        // Calculate control points for rounded corner
        const d1 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
        const d2 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        
        const r = Math.min(radius, d1 / 2, d2 / 2);
        
        const t1x = p1.x - (p1.x - p0.x) * (r / d1);
        const t1y = p1.y - (p1.y - p0.y) * (r / d1);
        const t2x = p1.x + (p2.x - p1.x) * (r / d2);
        const t2y = p1.y + (p2.y - p1.y) * (r / d2);
        
        ctx.lineTo(t1x, t1y);
        ctx.quadraticCurveTo(p1.x, p1.y, t2x, t2y);
      }
    }

    if (closed) {
      // Close the loop
      const p0 = points[len - 1];
      const p1 = points[0];
      const p2 = points[1];
      
      const d1 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
      const d2 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      
      const r = Math.min(radius, d1 / 2, d2 / 2);
      
      const t1x = p1.x - (p1.x - p0.x) * (r / d1);
      const t1y = p1.y - (p1.y - p0.y) * (r / d1);
      const t2x = p1.x + (p2.x - p1.x) * (r / d2);
      const t2y = p1.y + (p2.y - p1.y) * (r / d2);
      
      ctx.lineTo(t1x, t1y);
      ctx.quadraticCurveTo(p1.x, p1.y, t2x, t2y);
      ctx.closePath();
    }
  }

  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw a stroked polygon
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Array<{x: number, y: number}>} points - Array of vertex positions
 * @param {string|Object} color - Stroke color
 * @param {boolean} closed - Whether to close the path (default: true)
 * @param {number} lineWidth - Stroke width in pixels (default: 2)
 */
export function strokePoly(ctx, points, color, closed = true, lineWidth = 2) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  if (closed) {
    ctx.closePath();
  }

  setStrokeColor(ctx, color, lineWidth);
  ctx.stroke();
}

/**
 * Draw a line segment
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x1 - Start X position
 * @param {number} y1 - Start Y position
 * @param {number} x2 - End X position
 * @param {number} y2 - End Y position
 * @param {string|Object} color - Stroke color
 * @param {number} lineWidth - Stroke width in pixels (default: 2)
 */
export function drawLine(ctx, x1, y1, x2, y2, color, lineWidth = 2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  setStrokeColor(ctx, color, lineWidth);
  ctx.stroke();
}

/**
 * Draw a filled ellipse
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} radiusX - Horizontal radius
 * @param {number} radiusY - Vertical radius
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: 0)
 */
export function drawEllipse(ctx, x, y, radiusX, radiusY, color, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw a regular polygon (triangle, square, pentagon, hexagon, etc.)
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} radius - Distance from center to vertex
 * @param {number} sides - Number of sides (3 = triangle, 4 = square, etc.)
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: 0)
 */
export function drawRegularPoly(ctx, x, y, radius, sides, color, rotation = 0) {
  const angleStep = (Math.PI * 2) / sides;

  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * angleStep - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw a star shape
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} outerRadius - Distance to outer points
 * @param {number} innerRadius - Distance to inner valleys
 * @param {number} points - Number of points on the star
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: 0)
 */
export function drawStar(ctx, x, y, outerRadius, innerRadius, points, color, rotation = 0) {
  const angleStep = Math.PI / points;

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation + i * angleStep - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  setFillColor(ctx, color);
  ctx.fill();
}

/**
 * Draw an arrow
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x1 - Start X position
 * @param {number} y1 - Start Y position
 * @param {number} x2 - End X position
 * @param {number} y2 - End Y position
 * @param {string|Object} color - Fill/stroke color
 * @param {number} lineWidth - Line width in pixels (default: 2)
 * @param {number} headSize - Size of arrow head in pixels (default: 10)
 */
export function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth = 2, headSize = 10) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  // Draw line
  drawLine(ctx, x1, y1, x2, y2, color, lineWidth);

  // Draw arrow head
  const headAngle = Math.PI / 6; // 30 degrees
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle - headAngle),
    y2 - headSize * Math.sin(angle - headAngle)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle + headAngle),
    y2 - headSize * Math.sin(angle + headAngle)
  );
  setStrokeColor(ctx, color, lineWidth);
  ctx.stroke();
}

/**
 * Draw a checkmark
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} size - Size of the checkmark
 * @param {string|Object} color - Stroke color
 * @param {number} lineWidth - Stroke width in pixels (default: 3)
 */
export function drawCheckmark(ctx, x, y, size, color, lineWidth = 3) {
  const s = size / 2;
  
  ctx.beginPath();
  // Start from bottom left, go up, then right
  ctx.moveTo(x - s * 0.4, y);
  ctx.lineTo(x - s * 0.1, y + s * 0.5);
  ctx.lineTo(x + s * 0.6, y - s * 0.6);
  setStrokeColor(ctx, color, lineWidth);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  
  // Reset line cap/join
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

/**
 * Draw an X shape
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} size - Size of the X
 * @param {string|Object} color - Stroke color
 * @param {number} lineWidth - Stroke width in pixels (default: 3)
 */
export function drawX(ctx, x, y, size, color, lineWidth = 3) {
  const s = size / 2;
  const offset = s * 0.4;
  
  ctx.beginPath();
  ctx.moveTo(x - offset, y - offset);
  ctx.lineTo(x + offset, y + offset);
  ctx.moveTo(x + offset, y - offset);
  ctx.lineTo(x - offset, y + offset);
  setStrokeColor(ctx, color, lineWidth);
  ctx.lineCap = 'round';
  ctx.stroke();
  
  ctx.lineCap = 'butt';
}
