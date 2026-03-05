/**
 * Water Sort - Canvas Renderer
 *
 * Renders the water sort puzzle with:
 * - Glass tubes with colored liquid layers
 * - Pour animations
 * - Selection and preview highlights
 */

// Color mapping defined locally for water-sort game

const TUBE_WIDTH = 60;
const TUBE_HEIGHT = 180;
const TUBE_GAP = 20;
const LIQUID_SEGMENT_HEIGHT = 40;
const TUBE_BORDER_RADIUS = 8;

const COLOR_MAP = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  yellow: '#f1c40f',
  purple: '#9b59b6',
  orange: '#e67e22',
  cyan: '#00bcd4',
  pink: '#e91e63'
};

/**
 * Create renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let reducedMotion = false;
  let animationFrame = null;
  
  // Animation state
  const animations = new Map();
  
  return {
    get scale() { return scale; },
    
    setReducedMotion(enabled) {
      reducedMotion = enabled;
    },
    
    /**
     * Resize canvas to fit state
     */
    resize(state) {
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 200;
      
      const numTubes = state.tubes.length;
      const tubesPerRow = Math.min(numTubes, Math.floor(containerWidth / (TUBE_WIDTH + TUBE_GAP)));
      const rows = Math.ceil(numTubes / tubesPerRow);
      
      const totalWidth = tubesPerRow * TUBE_WIDTH + (tubesPerRow - 1) * TUBE_GAP;
      const totalHeight = rows * TUBE_HEIGHT + (rows - 1) * TUBE_GAP;
      
      scale = Math.min(
        containerWidth / totalWidth,
        containerHeight / totalHeight,
        1.5
      );
      
      canvas.width = totalWidth * scale;
      canvas.height = totalHeight * scale;
      
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
    },
    
    /**
     * Render current state
     */
    render(state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const numTubes = state.tubes.length;
      const tubesPerRow = Math.floor(canvas.width / ((TUBE_WIDTH + TUBE_GAP) * scale));
      
      state.tubes.forEach((tube, index) => {
        const pos = this.getTubePosition(index, numTubes, tubesPerRow);
        const isSelected = state.selectedTube === index;
        const isPreview = state.pourPreview?.to === index;
        
        this.drawTube(tube, pos.x, pos.y, state.capacity, isSelected, isPreview);
      });
    },
    
    /**
     * Get tube position by index
     */
    getTubePosition(index, totalTubes, tubesPerRow) {
      tubesPerRow = tubesPerRow || Math.floor(canvas.width / ((TUBE_WIDTH + TUBE_GAP) * scale)) || 1;
      const row = Math.floor(index / tubesPerRow);
      const col = index % tubesPerRow;
      const tubesInRow = Math.min(tubesPerRow, totalTubes - row * tubesPerRow);
      const rowWidth = tubesInRow * TUBE_WIDTH + (tubesInRow - 1) * TUBE_GAP;
      const startX = (canvas.width / scale - rowWidth) / 2;
      
      return {
        x: startX + col * (TUBE_WIDTH + TUBE_GAP),
        y: row * (TUBE_HEIGHT + TUBE_GAP) + 20
      };
    },
    
    /**
     * Draw a single tube with liquid
     */
    drawTube(tube, x, y, capacity, isSelected, isPreview) {
      const scaledX = x * scale;
      const scaledY = y * scale;
      const scaledWidth = TUBE_WIDTH * scale;
      const scaledHeight = TUBE_HEIGHT * scale;
      const borderRadius = TUBE_BORDER_RADIUS * scale;
      
      // Draw glass tube background
      ctx.save();
      
      // Outer glow for selection
      if (isSelected) {
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 20 * scale;
      }
      
      // Glass tube outline
      ctx.strokeStyle = isSelected ? '#00d4ff' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = isSelected ? 3 * scale : 2 * scale;
      
      // Draw tube shape (rounded rectangle, open at top)
      ctx.beginPath();
      ctx.moveTo(scaledX + borderRadius, scaledY);
      ctx.lineTo(scaledX + scaledWidth - borderRadius, scaledY);
      ctx.quadraticCurveTo(scaledX + scaledWidth, scaledY, scaledX + scaledWidth, scaledY + borderRadius);
      ctx.lineTo(scaledX + scaledWidth, scaledY + scaledHeight - borderRadius);
      ctx.quadraticCurveTo(scaledX + scaledWidth, scaledY + scaledHeight, scaledX + scaledWidth - borderRadius, scaledY + scaledHeight);
      ctx.lineTo(scaledX + borderRadius, scaledY + scaledHeight);
      ctx.quadraticCurveTo(scaledX, scaledY + scaledHeight, scaledX, scaledY + scaledHeight - borderRadius);
      ctx.lineTo(scaledX, scaledY + borderRadius);
      ctx.quadraticCurveTo(scaledX, scaledY, scaledX + borderRadius, scaledY);
      ctx.stroke();
      
      ctx.restore();
      
      // Draw liquid segments from bottom to top
      const segmentHeight = (scaledHeight - borderRadius * 2) / capacity;
      const liquidWidth = scaledWidth - 8 * scale;
      const liquidStartX = scaledX + 4 * scale;
      
      tube.forEach((color, i) => {
        const segmentY = scaledY + scaledHeight - borderRadius - (i + 1) * segmentHeight;
        const hexColor = COLOR_MAP[color] || '#888888';
        
        // Draw liquid segment
        ctx.fillStyle = hexColor;
        
        // Bottom segment has rounded corners
        if (i === 0) {
          ctx.beginPath();
          ctx.roundRect(
            liquidStartX,
            segmentY,
            liquidWidth,
            segmentHeight + 2 * scale,
            [0, 0, borderRadius - 2 * scale, borderRadius - 2 * scale]
          );
          ctx.fill();
        } else {
          ctx.fillRect(liquidStartX, segmentY, liquidWidth, segmentHeight + 2 * scale);
        }
        
        // Add shine effect
        const gradient = ctx.createLinearGradient(liquidStartX, segmentY, liquidStartX + liquidWidth, segmentY);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
        
        ctx.fillStyle = gradient;
        if (i === 0) {
          ctx.beginPath();
          ctx.roundRect(
            liquidStartX,
            segmentY,
            liquidWidth,
            segmentHeight + 2 * scale,
            [0, 0, borderRadius - 2 * scale, borderRadius - 2 * scale]
          );
          ctx.fill();
        } else {
          ctx.fillRect(liquidStartX, segmentY, liquidWidth, segmentHeight + 2 * scale);
        }
      });
      
      // Preview highlight
      if (isPreview) {
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 3 * scale;
        ctx.setLineDash([5 * scale, 5 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
    
    /**
     * Convert canvas coordinates to tube index
     */
    getTubeAtPosition(canvasX, canvasY, state) {
      const numTubes = state.tubes.length;
      const tubesPerRow = Math.floor(canvas.width / ((TUBE_WIDTH + TUBE_GAP) * scale)) || 1;
      
      for (let i = 0; i < numTubes; i++) {
        const pos = this.getTubePosition(i, numTubes, tubesPerRow);
        const scaledX = pos.x * scale;
        const scaledY = pos.y * scale;
        const scaledWidth = TUBE_WIDTH * scale;
        const scaledHeight = TUBE_HEIGHT * scale;
        
        if (
          canvasX >= scaledX &&
          canvasX <= scaledX + scaledWidth &&
          canvasY >= scaledY &&
          canvasY <= scaledY + scaledHeight
        ) {
          return i;
        }
      }
      
      return null;
    },
    
    /**
     * Animate pour between tubes
     */
    async animatePour(state, fromIndex, toIndex, onProgress) {
      if (reducedMotion) {
        onProgress?.();
        return;
      }
      
      return new Promise(resolve => {
        const duration = 300;
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Render with animation
          this.render(state);
          
          if (progress < 1) {
            animationFrame = requestAnimationFrame(animate);
          } else {
            onProgress?.();
            resolve();
          }
        };
        
        animate();
      });
    }
  };
}

export { COLOR_MAP };
