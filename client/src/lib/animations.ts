/**
 * TUTELA Playful Micro-Interaction Animation Library
 * A collection of delightful animations and micro-interactions for enhanced UX
 */

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: string;
  repeat?: number | 'infinite';
}

export interface ParticleConfig {
  count?: number;
  colors?: string[];
  size?: { min: number; max: number };
  velocity?: { min: number; max: number };
  lifetime?: number;
}

// Floating animations for cards and elements - reduced motion
export const floatingAnimation = (element: HTMLElement, config: AnimationConfig = {}) => {
  const {
    duration = 4000,
    delay = 0,
    easing = 'ease-in-out'
  } = config;

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  element.style.animation = `floating ${duration}ms ${easing} ${delay}ms infinite`;
};

// Bounce animation for buttons and interactive elements - smoother
export const bounceIn = (element: HTMLElement, config: AnimationConfig = {}) => {
  const {
    duration = 500,
    delay = 0,
    easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  } = config;

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.style.opacity = '1';
    element.style.transform = 'scale(1)';
    return;
  }

  element.style.animation = `bounceIn ${duration}ms ${easing} ${delay}ms forwards`;
};

// Pulse animation for attention-grabbing elements - gentler
export const pulse = (element: HTMLElement, config: AnimationConfig = {}) => {
  const {
    duration = 2500,
    repeat = 'infinite',
    easing = 'ease-in-out'
  } = config;

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  element.style.animation = `pulse ${duration}ms ${easing} ${repeat}`;
};

// Shake animation for form validation errors
export const shake = (element: HTMLElement, config: AnimationConfig = {}) => {
  const {
    duration = 600,
    easing = 'ease-in-out'
  } = config;

  element.style.animation = `shake ${duration}ms ${easing}`;
  
  // Remove animation after completion
  setTimeout(() => {
    element.style.animation = '';
  }, duration);
};

// Slide in from different directions
export const slideIn = (element: HTMLElement, direction: 'left' | 'right' | 'top' | 'bottom' = 'left', config: AnimationConfig = {}) => {
  const {
    duration = 500,
    delay = 0,
    easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  } = config;

  element.style.animation = `slideIn${direction.charAt(0).toUpperCase() + direction.slice(1)} ${duration}ms ${easing} ${delay}ms forwards`;
};

// Scale animation for hover effects - gentler
export const scaleOnHover = (element: HTMLElement, scale: number = 1.02) => {
  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  element.addEventListener('mouseenter', () => {
    element.style.transform = `scale(${scale})`;
    element.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
  });

  element.addEventListener('mouseleave', () => {
    element.style.transform = 'scale(1)';
  });
};

// Ripple effect for buttons
export const rippleEffect = (element: HTMLElement, event: MouseEvent) => {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: scale(0);
    animation: ripple 600ms ease-out;
    pointer-events: none;
  `;

  element.style.position = 'relative';
  element.style.overflow = 'hidden';
  element.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
};

// Confetti particles for success states
export const createConfetti = (container: HTMLElement, config: ParticleConfig = {}) => {
  const {
    count = 50,
    colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
    size = { min: 4, max: 8 },
    velocity = { min: 100, max: 200 },
    lifetime = 3000
  } = config;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const particleSize = Math.random() * (size.max - size.min) + size.min;
    const velX = (Math.random() - 0.5) * (velocity.max - velocity.min) + velocity.min;
    const velY = Math.random() * velocity.max + velocity.min;

    particle.style.cssText = `
      position: absolute;
      width: ${particleSize}px;
      height: ${particleSize}px;
      background: ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    `;

    container.appendChild(particle);

    // Animate particle
    particle.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      { 
        transform: `translate(${velX}px, ${-velY}px) rotate(360deg)`, 
        opacity: 0 
      }
    ], {
      duration: lifetime,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });

    setTimeout(() => {
      particle.remove();
    }, lifetime);
  }
};

// Typewriter effect for text
export const typewriterEffect = (element: HTMLElement, text: string, speed: number = 50) => {
  element.textContent = '';
  let i = 0;

  const typeInterval = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(typeInterval);
    }
  }, speed);

  return typeInterval;
};

// Magnetic effect for interactive elements
export const magneticEffect = (element: HTMLElement, strength: number = 0.3) => {
  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    element.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    element.style.transition = 'transform 0.1s ease-out';
  });

  element.addEventListener('mouseleave', () => {
    element.style.transform = 'translate(0, 0)';
    element.style.transition = 'transform 0.3s ease-out';
  });
};

// Loading dots animation
export const loadingDots = (element: HTMLElement, dotCount: number = 3) => {
  element.innerHTML = '';
  
  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      background: currentColor;
      border-radius: 50%;
      display: inline-block;
      margin: 0 2px;
      animation: loadingDots 1.4s ease-in-out ${i * 0.2}s infinite;
    `;
    element.appendChild(dot);
  }
};

// Number counter animation
export const animateNumber = (element: HTMLElement, target: number, duration: number = 2000) => {
  const start = 0;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(start + (target - start) * easeOutQuart);
    
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      element.textContent = target.toLocaleString();
    }
  };

  animate();
};

// Parallax scroll effect
export const parallaxScroll = (element: HTMLElement, speed: number = 0.5) => {
  const updateParallax = () => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -speed;
    element.style.transform = `translateY(${rate}px)`;
  };

  window.addEventListener('scroll', updateParallax);
  return () => window.removeEventListener('scroll', updateParallax);
};

// Morphing loader
export const morphingLoader = (element: HTMLElement) => {
  element.style.cssText = `
    width: 40px;
    height: 40px;
    background: linear-gradient(45deg, #10b981, #3b82f6);
    border-radius: 50%;
    animation: morphing 2s ease-in-out infinite;
  `;
};