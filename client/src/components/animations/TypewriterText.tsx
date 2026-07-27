import React, { useEffect, useRef, useState } from 'react';

interface TypewriterTextProps {
  text: string | string[];
  speed?: number;
  delay?: number;
  loop?: boolean;
  className?: string;
  cursor?: boolean;
  pauseDuration?: number; // Pause between texts when looping
}

export function TypewriterText({ 
  text, 
  speed = 50, 
  delay = 0,
  loop = false,
  className,
  cursor = true,
  pauseDuration = 1000
}: TypewriterTextProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const texts = Array.isArray(text) ? text : [text];

  useEffect(() => {
    if (!elementRef.current) return;

    const typeText = (textToType: string, startIndex: number = 0) => {
      setIsTyping(true);
      let i = startIndex;

      const typeInterval = setInterval(() => {
        if (i <= textToType.length) {
          setCurrentText(textToType.substring(0, i));
          i++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);

          if (loop && texts.length > 1) {
            setTimeout(() => {
              // Move to next text
              const nextIndex = (currentIndex + 1) % texts.length;
              setCurrentIndex(nextIndex);
              
              // Erase current text
              eraseText(() => {
                setTimeout(() => {
                  typeText(texts[nextIndex]);
                }, 200);
              });
            }, pauseDuration);
          }
        }
      }, speed);

      return typeInterval;
    };

    const eraseText = (callback?: () => void) => {
      let i = currentText.length;

      const eraseInterval = setInterval(() => {
        if (i >= 0) {
          setCurrentText(currentText.substring(0, i));
          i--;
        } else {
          clearInterval(eraseInterval);
          callback?.();
        }
      }, speed / 2);

      return eraseInterval;
    };

    const startTyping = () => {
      setTimeout(() => {
        typeText(texts[currentIndex]);
      }, delay);
    };

    startTyping();
  }, [currentIndex, speed, delay, loop, pauseDuration, texts]);

  return (
    <span ref={elementRef} className={className}>
      {currentText}
      {cursor && (
        <span 
          className={`inline-block w-0.5 bg-current ml-1 ${
            isTyping ? 'animate-pulse' : 'animate-pulse'
          }`}
          style={{ height: '1em' }}
        />
      )}
    </span>
  );
}