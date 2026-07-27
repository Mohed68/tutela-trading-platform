import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, TrendingUp, Users, Zap, ChevronRight, CheckCircle, ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";
import TutelaLogo from "@/components/common/TutelaLogo";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen tutela-header-gradient">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <TutelaLogo size="lg" showText={true} />
          <Button onClick={handleLogin} className="tutela-btn-primary">
            Sign In
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-6">
            <span className="text-neutral-900 tracking-tight">Secure Physical Commodity Trading</span>
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
              with AI & Blockchain
            </span>
          </h1>
          <p className="text-xl mb-8 leading-relaxed text-neutral-600 font-light">
            TUTELA is the leading digital platform for primary physical commodity trading, 
            specializing in Fuel & Hydrocarbons, Metals & Precious Metals, and Agricultural products. 
            Our proprietary validation and verification process ensures secure, authenticated transactions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Get Started <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 font-medium transition-all duration-200"
              onClick={() => {
                const event = new CustomEvent('openDemoModal');
                window.dispatchEvent(event);
              }}
            >
              View Demo <TrendingUp className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--tutela-secondary)' }}>
            Why Choose TUTELA?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our platform combines cutting-edge technology with industry expertise to deliver 
            the most secure and efficient commodity trading experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="tutela-metric-card text-center">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--tutela-blue-100)', color: 'var(--tutela-primary)' }}>
                <Shield className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">AI-Powered Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Advanced AI algorithms validate documents, partners, and transactions to prevent fraud and ensure authenticity.
              </p>
            </CardContent>
          </Card>

          <Card className="tutela-metric-card text-center">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--tutela-gray-100)', color: 'var(--tutela-secondary)' }}>
                <Zap className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Blockchain Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Smart contracts on blockchain technology ensure transparent, immutable, and secure transaction records.
              </p>
            </CardContent>
          </Card>

          <Card className="tutela-metric-card text-center">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--tutela-blue-50)', color: 'var(--tutela-accent)' }}>
                <Users className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Verified Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Trade only with pre-verified, qualified partners based on financial rating, credit score, and business credentials.
              </p>
            </CardContent>
          </Card>

          <Card className="tutela-metric-card text-center">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, var(--tutela-blue-50) 0%, var(--tutela-gray-50) 100%)', color: 'var(--tutela-primary)' }}>
                <TrendingUp className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Market Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Real-time market data, price forecasting, and trading insights powered by AI to optimize your trading decisions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Commodities Section */}
      <section className="container mx-auto px-4 py-20 bg-white">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Supported Commodity Categories
          </h2>
          <p className="text-lg text-gray-600">
            Trade across major physical commodity sectors with full verification and blockchain integration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="tutela-metric-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 text-sm">⛽</span>
                </div>
                Fuel & Hydrocarbons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Crude Oil (WTI, Brent)</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Natural Gas</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Refined Products</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />LNG & LPG</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="tutela-metric-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-yellow-600 text-sm">🥇</span>
                </div>
                Metals & Precious Metals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Gold & Silver</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Platinum & Palladium</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Copper & Aluminum</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Steel & Iron Ore</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="tutela-metric-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-green-600 text-sm">🌾</span>
                </div>
                Agricultural Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Wheat & Corn</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Soybeans & Rice</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Coffee & Sugar</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" />Cotton & Livestock</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Active Marketplace Preview */}
      <section className="container mx-auto px-4 py-20" style={{ background: 'linear-gradient(135deg, var(--tutela-blue-50) 0%, var(--tutela-gray-50) 100%)' }}>
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mr-4" style={{ background: 'var(--tutela-primary)' }}>
              <ShoppingCart className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>
              Active Marketplace
            </h2>
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Explore live trading opportunities across global commodity markets. 
            Our marketplace features verified offers from trusted partners with real-time pricing and detailed specifications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="tutela-metric-card text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold mb-2" style={{ color: 'var(--tutela-primary)' }}>9+</div>
              <div className="text-sm font-medium text-gray-600">Active Offers</div>
              <div className="text-xs text-gray-500 mt-1">Live Trading Opportunities</div>
            </CardContent>
          </Card>
          <Card className="tutela-metric-card text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold mb-2" style={{ color: 'var(--tutela-accent)' }}>$2.1B+</div>
              <div className="text-sm font-medium text-gray-600">Total Value</div>
              <div className="text-xs text-gray-500 mt-1">Available for Trading</div>
            </CardContent>
          </Card>
          <Card className="tutela-metric-card text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold mb-2" style={{ color: 'var(--tutela-secondary)' }}>3</div>
              <div className="text-sm font-medium text-gray-600">Categories</div>
              <div className="text-xs text-gray-500 mt-1">Fuel, Metals, Agricultural</div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button onClick={() => setLocation('/commodities')} size="lg" className="tutela-btn-primary">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Browse Active Marketplace
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center bg-primary text-white rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Secure Commodity Trading?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join the future of physical commodity trading with AI validation and blockchain security.
          </p>
          <Button onClick={handleLogin} size="lg" variant="secondary" className="bg-white text-primary hover:bg-gray-100">
            Get Started Today <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">T</span>
              </div>
              <span className="text-xl font-bold">TUTELA</span>
            </div>
            <p className="text-gray-400 text-center md:text-right">
              © 2024 TUTELA. Secure Physical Commodity Trading Platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
