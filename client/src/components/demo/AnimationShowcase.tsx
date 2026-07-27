import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedButton } from '@/components/animations/AnimatedButton';
import { AnimatedCard } from '@/components/animations/AnimatedCard';
import { AnimatedNumber } from '@/components/animations/AnimatedNumber';
import { LoadingSpinner } from '@/components/animations/LoadingSpinner';
import { SuccessAnimation } from '@/components/animations/SuccessAnimation';
import { TypewriterText } from '@/components/animations/TypewriterText';
import { ScrollReveal } from '@/components/animations/ScrollReveal';
import { Play, Star, CheckCircle, Zap } from 'lucide-react';

export function AnimationShowcase() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [animateNumber, setAnimateNumber] = useState(false);

  return (
    <div className="space-y-8 p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-4">
          <TypewriterText 
            text="TUTELA Animation Library Showcase"
            speed={50}
          />
        </h1>
        <p className="text-neutral-600">
          Explore the playful micro-interactions that enhance user experience
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Animated Buttons */}
        <ScrollReveal animation="fade-up" delay={100}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                Animated Buttons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AnimatedButton animation="ripple" className="w-full">
                Ripple Effect
              </AnimatedButton>
              <AnimatedButton animation="sparkle" variant="outline" className="w-full">
                Sparkle Hover
              </AnimatedButton>
              <AnimatedButton animation="scale" size="sm" className="w-full">
                Scale on Hover
              </AnimatedButton>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Animated Numbers */}
        <ScrollReveal animation="fade-up" delay={200}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-blue-600" />
                Animated Numbers
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div>
                <div className="text-3xl font-bold text-emerald-600">
                  <AnimatedNumber 
                    value={1250000} 
                    prefix="$" 
                    trigger={animateNumber}
                  />
                </div>
                <p className="text-sm text-neutral-600">Total Trade Volume</p>
              </div>
              <Button 
                onClick={() => setAnimateNumber(!animateNumber)}
                variant="outline"
                size="sm"
              >
                Animate
              </Button>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Loading Spinners */}
        <ScrollReveal animation="fade-up" delay={300}>
          <Card>
            <CardHeader>
              <CardTitle>Loading States</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Default Spinner</span>
                <LoadingSpinner variant="spinner" size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span>Animated Dots</span>
                <LoadingSpinner variant="dots" />
              </div>
              <div className="flex items-center justify-between">
                <span>Morphing</span>
                <LoadingSpinner variant="morphing" size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span>Pulse</span>
                <LoadingSpinner variant="pulse" size="sm" />
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Animated Cards */}
        <ScrollReveal animation="slide-left" delay={400}>
          <AnimatedCard animation="hover-lift" className="h-full">
            <CardHeader>
              <CardTitle>Hover Effects</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-600">
                This card lifts up when you hover over it, creating a delightful interaction.
              </p>
            </CardContent>
          </AnimatedCard>
        </ScrollReveal>

        {/* Magnetic Card */}
        <ScrollReveal animation="slide-right" delay={500}>
          <AnimatedCard animation="magnetic" className="h-full">
            <CardHeader>
              <CardTitle>Magnetic Effect</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-600">
                Move your mouse around this card to see the magnetic effect in action.
              </p>
            </CardContent>
          </AnimatedCard>
        </ScrollReveal>

        {/* Success Animation */}
        <ScrollReveal animation="fade-up" delay={600}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Success Animation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowSuccess(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Play className="mr-2 w-4 h-4" />
                Show Success
              </Button>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>

      {/* Typewriter Examples */}
      <ScrollReveal animation="fade-up" delay={700}>
        <Card>
          <CardHeader>
            <CardTitle>Typewriter Effects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Single Text:</h3>
              <TypewriterText 
                text="Welcome to TUTELA, your trusted commodity trading platform!"
                speed={50}
                className="text-lg text-emerald-600"
              />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Looping Text:</h3>
              <TypewriterText 
                text={[
                  "Trade with confidence",
                  "Verified counterparties",
                  "Secure transactions",
                  "Global marketplace"
                ]}
                speed={80}
                loop={true}
                className="text-lg text-blue-600"
              />
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Success Modal */}
      <SuccessAnimation 
        show={showSuccess}
        message="Animation Complete!"
        onComplete={() => setShowSuccess(false)}
      />
    </div>
  );
}