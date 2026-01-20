import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface SilkRibbonProps {
  className?: string;
  delay?: number;
  titleWidth?: number; // Width of the title in pixels to adapt ribbon length
  debug?: boolean; // Show collision surfaces for debugging
}

// Cloth simulation parameters - silk-like physics
const DAMPING = 0.05;
const MASS = 0.08; // Light silk
const GRAVITY = 150; // Very gentle gravity for floating effect
const TIMESTEP = 16 / 1000;
const TIMESTEP_SQ = TIMESTEP * TIMESTEP;

// Ribbon dimensions
const RIBBON_HEIGHT = 4; // segments - ribbon thickness
const SEGMENT_SIZE = 5;
const TAIL_SEGMENTS = 5; // Segments for the hanging tail
const HEADER_Y = 18; // Y position where the header text is (collision surface)

// Particle class for cloth simulation
class Particle {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  original: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  invMass: number;
  pinned: boolean;
  restY: number;
  drag: number;

  constructor(x: number, y: number, z: number, mass: number, restY: number = 0, drag: number = 0.95) {
    this.position = new THREE.Vector3(x, y, z);
    this.previous = new THREE.Vector3(x, y, z);
    this.original = new THREE.Vector3(x, y, z);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.mass = mass;
    this.invMass = 1 / mass;
    this.pinned = false;
    this.restY = restY;
    this.drag = drag;
  }

  addForce(force: THREE.Vector3) {
    this.acceleration.add(
      new THREE.Vector3().copy(force).multiplyScalar(this.invMass)
    );
  }

  integrate(timesq: number) {
    if (this.pinned) return;
    
    const newPos = new THREE.Vector3().subVectors(this.position, this.previous);
    newPos.multiplyScalar(this.drag);
    newPos.add(this.position);
    newPos.add(this.acceleration.multiplyScalar(timesq));
    
    // Floor collision - ribbon rests on the header
    if (newPos.y < this.restY) {
      newPos.y = this.restY;
      this.previous.y = newPos.y + (this.previous.y - newPos.y) * 0.3;
    }
    
    this.previous.copy(this.position);
    this.position.copy(newPos);
    this.acceleration.set(0, 0, 0);
  }
}

// Constraint class for connecting particles
class Constraint {
  p1: Particle;
  p2: Particle;
  distance: number;

  constructor(p1: Particle, p2: Particle, distance: number) {
    this.p1 = p1;
    this.p2 = p2;
    this.distance = distance;
  }

  satisfy() {
    const diff = new THREE.Vector3().subVectors(this.p2.position, this.p1.position);
    const currentDist = diff.length();
    if (currentDist === 0) return;
    
    const correction = diff.multiplyScalar(1 - this.distance / currentDist);
    const correctionHalf = correction.multiplyScalar(0.5);
    
    if (!this.p1.pinned) {
      this.p1.position.add(correctionHalf);
    }
    if (!this.p2.pinned) {
      this.p2.position.sub(correctionHalf);
    }
  }
}

// Cloth class with upward-tilted tail
class Cloth {
  particles: Particle[][];
  constraints: Constraint[];
  width: number;
  height: number;
  mainWidth: number;

  constructor(mainWidth: number, h: number, segmentSize: number) {
    this.mainWidth = mainWidth;
    this.width = mainWidth + TAIL_SEGMENTS;
    this.height = h;
    this.particles = [];
    this.constraints = [];

    // Create particles
    for (let y = 0; y <= h; y++) {
      this.particles[y] = [];
      for (let x = 0; x <= this.width; x++) {
        let px: number, py: number, pz: number, restY: number;
        
        if (x <= mainWidth) {
          // Main horizontal ribbon section - lies flat on header text
          px = x * segmentSize - 10; // Start from near left edge
          py = 55; // Start above (falling from here)
          pz = y * segmentSize - (h * segmentSize) / 2;
          restY = HEADER_Y; // Rests on header text level
        } else {
          // Tail section - hangs down from header
          const tailIndex = x - mainWidth;
          px = mainWidth * segmentSize - 10 + tailIndex * segmentSize * 0.3; // Continue rightward slightly
          py = 55; // Start from same height
          pz = y * segmentSize - (h * segmentSize) / 2;
          // Rest position goes down - each segment hangs lower
          restY = HEADER_Y - tailIndex * segmentSize * 0.8; // Hangs below header
        }
        
        // Varying air resistance
        const baseDrag = 1 - DAMPING;
        const airVariation = 0.02 * Math.sin(x * 0.5 + y * 0.3) + 0.01 * (Math.random() - 0.5);
        const drag = baseDrag - airVariation - (y * 0.005);
        
        this.particles[y][x] = new Particle(px, py, pz, MASS, restY, drag);
      }
    }

    // Create constraints
    for (let y = 0; y <= h; y++) {
      for (let x = 0; x <= this.width; x++) {
        // Horizontal
        if (x < this.width) {
          const stiffness = x >= mainWidth ? 1.01 : 1.02;
          this.constraints.push(
            new Constraint(this.particles[y][x], this.particles[y][x + 1], segmentSize * stiffness)
          );
        }
        // Vertical
        if (y < h) {
          this.constraints.push(
            new Constraint(this.particles[y][x], this.particles[y + 1][x], segmentSize * 1.02)
          );
        }
        // Diagonal
        if (x < this.width && y < h) {
          this.constraints.push(
            new Constraint(
              this.particles[y][x],
              this.particles[y + 1][x + 1],
              segmentSize * Math.sqrt(2) * 1.05
            )
          );
          this.constraints.push(
            new Constraint(
              this.particles[y + 1][x],
              this.particles[y][x + 1],
              segmentSize * Math.sqrt(2) * 1.05
            )
          );
        }
      }
    }
  }

  simulate(windStrength: number = 0) {
    const gravity = new THREE.Vector3(0, -GRAVITY, 0).multiplyScalar(MASS);
    
    for (let y = 0; y <= this.height; y++) {
      for (let x = 0; x <= this.width; x++) {
        const particle = this.particles[y][x];
        particle.addForce(gravity);
        
        if (windStrength > 0) {
          const wind = new THREE.Vector3(
            Math.sin(x * 0.3 + windStrength) * 5,
            Math.cos(y * 0.5 + windStrength) * 2,
            Math.sin(x * 0.2 + y * 0.4 + windStrength) * 3
          );
          particle.addForce(wind);
        }
        
        particle.integrate(TIMESTEP_SQ);
      }
    }

    for (let i = 0; i < 4; i++) {
      for (const constraint of this.constraints) {
        constraint.satisfy();
      }
    }
  }
}

export function VelvetRibbon({ className = '', delay = 500, titleWidth = 120, debug = false }: SilkRibbonProps) {
  //return;
  debug = true;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Calculate ribbon segments based on title width
  const ribbonWidth = Math.max(15, Math.floor(titleWidth / 8));

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!isVisible || !containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    // Setup Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 1, 10000);
    camera.position.set(50, 35, 140);
    camera.lookAt(50, HEADER_Y, 0);

    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(30, 80, 100);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.4);
    fillLight.position.set(-30, 40, 50);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xff9999, 0.3);
    rimLight.position.set(0, -20, -50);
    scene.add(rimLight);

    // Create cloth
    const cloth = new Cloth(ribbonWidth, RIBBON_HEIGHT, SEGMENT_SIZE);
    const totalWidth = ribbonWidth + TAIL_SEGMENTS;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];

    for (let y = 0; y <= RIBBON_HEIGHT; y++) {
      for (let x = 0; x <= totalWidth; x++) {
        const p = cloth.particles[y][x];
        vertices.push(p.position.x, p.position.y, p.position.z);
        uvs.push(x / totalWidth, y / RIBBON_HEIGHT);
        normals.push(0, 1, 0);
      }
    }

    for (let y = 0; y < RIBBON_HEIGHT; y++) {
      for (let x = 0; x < totalWidth; x++) {
        const a = y * (totalWidth + 1) + x;
        const b = a + 1;
        const c = a + (totalWidth + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    // Silk material
    const material = new THREE.MeshPhongMaterial({
      color: 0xc41e3a, // Crimson red
      specular: 0xffcccc,
      shininess: 100,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    //return true;
    // DEBUG: Add collision surface visualization
    if (debug) {
      // Main collision plane at HEADER_Y - where ribbon rests on header text
      const mainPlaneWidth = ribbonWidth * SEGMENT_SIZE;
      const mainPlaneGeometry = new THREE.PlaneGeometry(mainPlaneWidth + 20, 30);
      const mainPlaneMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Green for main surface (header text level)
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const mainPlane = new THREE.Mesh(mainPlaneGeometry, mainPlaneMaterial);
      mainPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
      mainPlane.position.set(mainPlaneWidth / 2 - 10, HEADER_Y, 0); // Position at HEADER_Y
      scene.add(mainPlane);

      // Tail collision surface (slopes downward from header)
      const tailLength = TAIL_SEGMENTS * SEGMENT_SIZE;
      const tailPlaneGeometry = new THREE.PlaneGeometry(tailLength, 30);
      const tailPlaneMaterial = new THREE.MeshBasicMaterial({
        color: 0xff00ff, // Magenta for tail surface
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const tailPlane = new THREE.Mesh(tailPlaneGeometry, tailPlaneMaterial);
      // Position at the end of main ribbon, sloping downward
      const tailStartX = mainPlaneWidth - 10;
      const tailEndX = tailStartX + TAIL_SEGMENTS * SEGMENT_SIZE * 0.3;
      const tailStartY = HEADER_Y;
      const tailEndY = HEADER_Y - TAIL_SEGMENTS * SEGMENT_SIZE * 0.8;
      tailPlane.rotation.x = -Math.PI / 2;
      // Calculate tilt angle
      const tiltAngle = Math.atan2(tailEndY - tailStartY, tailEndX - tailStartX);
      tailPlane.rotation.z = tiltAngle;
      tailPlane.position.set(
        (tailStartX + tailEndX) / 2,
        (tailStartY + tailEndY) / 2,
        0
      );
      scene.add(tailPlane);

      // Add axes helper to show coordinate system
      const axesHelper = new THREE.AxesHelper(50);
      scene.add(axesHelper);

      // Add grid helper at HEADER_Y (not y=0)
      const gridHelper = new THREE.GridHelper(200, 20, 0xffff00, 0x888888); // Yellow/gray grid
      gridHelper.position.y = HEADER_Y; // Position grid at header level
      scene.add(gridHelper);
      
      // Also add a reference plane at y=0 for comparison
      const groundPlane = new THREE.PlaneGeometry(200, 200);
      const groundMaterial = new THREE.MeshBasicMaterial({
        color: 0x0000ff, // Blue for ground level
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
      const ground = new THREE.Mesh(groundPlane, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      scene.add(ground);
    }

    let frameCount = 0;
    const maxFrames = 400;
    let settled = false;
    let windTime = 0;

    const animate = () => {
      if (!settled) {
        windTime += 0.02;
        const windStrength = frameCount < 200 ? windTime * 0.5 : 0;
        
        cloth.simulate(windStrength);
        frameCount++;
        
        if (frameCount > maxFrames) {
          settled = true;
        }
      }

      const positions = geometry.attributes.position as THREE.BufferAttribute;
      let index = 0;
      for (let y = 0; y <= RIBBON_HEIGHT; y++) {
        for (let x = 0; x <= totalWidth; x++) {
          const p = cloth.particles[y][x];
          positions.setXYZ(index, p.position.x, p.position.y, p.position.z);
          index++;
        }
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();

      renderer.render(scene, camera);
      
      if (!settled) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isVisible, ribbonWidth, debug]);

  if (!isVisible) return null;

  // Container width based on title width + extra for tail
  const containerWidth = Math.max(300, titleWidth + 100);

  return (
    <div 
      ref={containerRef}
      className={`ribbon-3d-container ${className}`}
      style={{
        position: 'absolute',
        top: '-8px',
        left: '-25px',
        width: `${containerWidth}px`,
        height: '60px',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
