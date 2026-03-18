/**
 * Reusable Canvas 2D drawing primitives
 *
 * All shapes use logical pixels for consistent sizing across devices.
 * Colors can be hex strings, color objects, or CanvasGradient/CanvasPattern.
 */

/**
 * Draw a filled circle
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} radius - Circle radius
 * @param {string|Object} color - Fill color (hex, color object, or gradient)
 */
export function drawCircle(ctx, x, y, radius, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a stroked circle
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} radius - Circle radius
 * @param {string|Object} color - Stroke color
 * @param {number} lineWidth - Stroke width (default: 2)
 */
export function strokeCircle(ctx, x, y, radius, color, lineWidth = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = normalizeColor(color);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a filled rectangle with optional border radius
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Top-left X position
 * @param {number} y - Top-left Y position
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {string|Object} color - Fill color
 * @param {number} borderRadius - Border radius (default: 0)
 */
export function drawRect(ctx, x, y, width, height, color, borderRadius = 0) {
  ctx.save();
  ctx.beginPath();

  if (borderRadius > 0) {
    roundRectPath(ctx, x, y, width, height, borderRadius);
  } else {
    ctx.rect(x, y, width, height);
  }

  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a stroked rectangle with optional border radius
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Top-left X position
 * @param {number} y - Top-left Y position
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {string|Object} color - Stroke color
 * @param {number} borderRadius - Border radius (default: 0)
 * @param {number} lineWidth - Stroke width (default: 2)
 */
export function strokeRect(ctx, x, y, width, height, color, borderRadius = 0, lineWidth = 2) {
  ctx.save();
  ctx.beginPath();

  if (borderRadius > 0) {
    roundRectPath(ctx, x, y, width, height, borderRadius);
  } else {
    ctx.rect(x, y, width, height);
  }

  ctx.strokeStyle = normalizeColor(color);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a filled triangle
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} size - Triangle size (distance from center to vertex)
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: 0, pointing up)
 */
export function drawTriangle(ctx, x, y, size, color, rotation = -Math.PI / 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();

  // Equilateral triangle with center at origin
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2 / 3) - Math.PI / 2;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a stroked triangle
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} size - Triangle size
 * @param {string|Object} color - Stroke color
 * @param {number} rotation - Rotation in radians (default: 0, pointing up)
 * @param {number} lineWidth - Stroke width (default: 2)
 */
export function strokeTriangle(ctx, x, y, size, color, rotation = -Math.PI / 2, lineWidth = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2 / 3) - Math.PI / 2;
    const px = Math.cos(angle) * size;
    const py = Math.sin(angle) * size;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.strokeStyle = normalizeColor(color);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a rounded polygon
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {Array<Object>} points - Array of {x, y} points
 * @param {number} radius - Corner radius
 * @param {string|Object} color - Fill color
 */
export function drawRoundedPoly(ctx, points, radius, color) {
  ctx.save();
  ctx.beginPath();

  if (points.length < 2) {
    ctx.restore();
    return;
  }

  // Create rounded path
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    if (i === 0) {
      ctx.moveTo(
        p0.x + Math.cos(Math.atan2(p1.y - p0.y, p1.x - p0.x)) * radius,
        p0.y + Math.sin(Math.atan2(p1.y - p0.y, p1.x - p0.x)) * radius
      );
    }

    const angle1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    ctx.lineTo(
      p1.x - Math.cos(angle2) * radius,
      p1.y - Math.sin(angle2) * radius
    );

    ctx.quadraticCurveTo(p1.x, p1.y, p1.x - Math.cos(angle1) * radius, p1.y - Math.sin(angle1) * radius);
  }

  ctx.closePath();
  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a line between two points
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x1 - Start X position
 * @param {number} y1 - Start Y position
 * @param {number} x2 - End X position
 * @param {number} y2 - End Y position
 * @param {string|Object} color - Line color
 * @param {number} lineWidth - Line width (default: 2)
 */
export function drawLine(ctx, x1, y1, x2, y2, color, lineWidth = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = normalizeColor(color);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw an arrow (line with arrowhead)
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x1 - Start X position
 * @param {number} y1 - Start Y position
 * @param {number} x2 - End X position
 * @param {number} y2 - End Y position
 * @param {string|Object} color - Arrow color
 * @param {number} lineWidth - Line width (default: 2)
 * @param {number} headSize - Arrowhead size (default: 10)
 */
export function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth = 2, headSize = 10) {
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = normalizeColor(color);
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - Math.cos(angle - Math.PI / 6) * headSize,
    y2 - Math.sin(angle - Math.PI / 6) * headSize
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - Math.cos(angle + Math.PI / 6) * headSize,
    y2 - Math.sin(angle + Math.PI / 6) * headSize
  );
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a pill shape (rectangle with fully rounded ends)
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Top-left X position
 * @param {number} y - Top-left Y position
 * @param {number} width - Pill width
 * @param {number} height - Pill height
 * @param {string|Object} color - Fill color
 */
export function drawPill(ctx, x, y, width, height, color) {
  const radius = Math.min(width, height) / 2;
  drawRect(ctx, x, y, width, height, color, radius);
}

/**
 * Draw a star shape
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} outerRadius - Outer radius of star
 * @param {number} innerRadius - Inner radius of star
 * @param {number} points - Number of points (default: 5)
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: -PI/2, pointing up)
 */
export function drawStar(ctx, x, y, outerRadius, innerRadius, points = 5, color, rotation = -Math.PI / 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}

/**
 * Create a rounded rectangle path
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Top-left X position
 * @param {number} y - Top-left Y position
 * @param {number} width - Rectangle width
 * @param {number} height - Rectangle height
 * @param {number} radius - Border radius
 */
function roundRectPath(ctx, x, y, width, height, radius) {
  // Clamp radius to half of shortest side
  const maxRadius = Math.min(width, height) / 2;
  const r = Math.min(radius, maxRadius);

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
}

/**
 * Set fill style from color object or string
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {string|Object} color - Fill color
 */
function setFillStyle(ctx, color) {
  if (typeof color === 'string') {
    ctx.fillStyle = color;
  } else if (color.hex) {
    ctx.fillStyle = color.hex;
  } else if (color.rgb) {
    ctx.fillStyle = `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
  } else {
    ctx.fillStyle = color;
  }
}

/**
 * Normalize color to CSS string
 *
 * @param {string|Object} color - Color to normalize
 * @returns {string} CSS color string
 */
function normalizeColor(color) {
  if (typeof color === 'string') {
    return color;
  }
  if (color.hex) {
    return color.hex;
  }
  if (color.rgb) {
    return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
  }
  return '#000000';
}

/**
 * Draw a donut shape (circle with hole)
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} outerRadius - Outer radius
 * @param {number} innerRadius - Inner radius (hole size)
 * @param {string|Object} color - Fill color
 */
export function drawDonut(ctx, x, y, outerRadius, innerRadius, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
  ctx.arc(x, y, innerRadius, 0, Math.PI * 2, true);
  ctx.closePath();
  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw an elliptical shape
 *
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} radiusX - Horizontal radius
 * @param {number} radiusY - Vertical radius
 * @param {string|Object} color - Fill color
 * @param {number} rotation - Rotation in radians (default: 0)
 */
export function drawEllipse(ctx, x, y, radiusX, radiusY, color, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  setFillStyle(ctx, color);
  ctx.fill();
  ctx.restore();
}
