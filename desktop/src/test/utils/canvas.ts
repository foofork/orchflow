import { vi } from 'vitest';

/**
 * Professional canvas mocking utilities
 * Provides testable canvas context without actual rendering
 */

export interface MockCanvasContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  
  // Drawing operations log for assertions
  operations: Array<{ method: string; args: any[] }>;
}

export function createMockCanvas2DContext(): MockCanvasContext & CanvasRenderingContext2D {
  const operations: Array<{ method: string; args: any[] }> = [];
  
  const logOperation = (method: string) => {
    return (...args: any[]) => {
      operations.push({ method, args });
    };
  };
  
  const context = {
    // State
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    
    // Operations log
    operations,
    
    // Canvas methods
    fillRect: vi.fn(logOperation('fillRect')),
    strokeRect: vi.fn(logOperation('strokeRect')),
    clearRect: vi.fn(logOperation('clearRect')),
    
    fillText: vi.fn(logOperation('fillText')),
    strokeText: vi.fn(logOperation('strokeText')),
    measureText: vi.fn((text: string) => ({
      width: text.length * 7, // Approximate width
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 7,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 3,
    })),
    
    beginPath: vi.fn(logOperation('beginPath')),
    closePath: vi.fn(logOperation('closePath')),
    moveTo: vi.fn(logOperation('moveTo')),
    lineTo: vi.fn(logOperation('lineTo')),
    arc: vi.fn(logOperation('arc')),
    arcTo: vi.fn(logOperation('arcTo')),
    bezierCurveTo: vi.fn(logOperation('bezierCurveTo')),
    quadraticCurveTo: vi.fn(logOperation('quadraticCurveTo')),
    rect: vi.fn(logOperation('rect')),
    
    fill: vi.fn(logOperation('fill')),
    stroke: vi.fn(logOperation('stroke')),
    clip: vi.fn(logOperation('clip')),
    
    save: vi.fn(logOperation('save')),
    restore: vi.fn(logOperation('restore')),
    scale: vi.fn(logOperation('scale')),
    rotate: vi.fn(logOperation('rotate')),
    translate: vi.fn(logOperation('translate')),
    transform: vi.fn(logOperation('transform')),
    setTransform: vi.fn(logOperation('setTransform')),
    
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createPattern: vi.fn(() => ({})),
    
    drawImage: vi.fn(logOperation('drawImage')),
    putImageData: vi.fn(logOperation('putImageData')),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb',
    })),
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb',
    })),
    
    // WebGL context detection
    isPointInPath: vi.fn(() => false),
    isPointInStroke: vi.fn(() => false),
  };
  
  return context as any;
}

export function createMockWebGLContext(): WebGLRenderingContext {
  const programs = new Map<WebGLProgram, { vertex?: WebGLShader; fragment?: WebGLShader }>();
  let currentProgram: WebGLProgram | null = null;
  
  return {
    // Constants
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    
    // State
    canvas: document.createElement('canvas'),
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    
    // Methods
    createShader: vi.fn((type: number) => ({ type, id: Math.random() })),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    
    createProgram: vi.fn(() => {
      const program = { id: Math.random() };
      programs.set(program as any, {});
      return program;
    }),
    attachShader: vi.fn((program: WebGLProgram, shader: WebGLShader) => {
      const p = programs.get(program);
      if (p) {
        if ((shader as any).type === 0x8B31) {
          p.vertex = shader;
        } else {
          p.fragment = shader;
        }
      }
    }),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    useProgram: vi.fn((program: WebGLProgram) => {
      currentProgram = program;
    }),
    
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({ id: Math.random() })),
    
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    
    createBuffer: vi.fn(() => ({ id: Math.random() })),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    
    viewport: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    
    // Add more methods as needed
  } as any;
}

// Helper to mock HTMLCanvasElement.getContext
export function mockCanvasGetContext() {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  
  HTMLCanvasElement.prototype.getContext = vi.fn(function(
    this: HTMLCanvasElement,
    contextType: string,
    _options?: any
  ) {
    if (contextType === '2d') {
      return createMockCanvas2DContext();
    } else if (contextType === 'webgl' || contextType === 'webgl2') {
      return createMockWebGLContext();
    }
    return null;
  }) as any;
  
  return () => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  };
}