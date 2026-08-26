import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Home, 
  ArrowLeft, 
  Compass,
  TrendingUp,
  Shield,
  Users,
  FileText,
  BarChart3
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  const popularPages = [
    {
      title: 'Marketplace',
      description: 'Browse commodity offers and trading opportunities',
      href: '/demo',
      icon: TrendingUp,
      badge: 'Popular'
    },
    {
      title: 'How It Works',
      description: 'Learn about our trading platform and verification process',
      href: '/how-it-works',
      icon: Compass,
      badge: null
    },
    {
      title: 'Pricing Plans',
      description: 'View our subscription plans and features',
      href: '/pricing',
      icon: BarChart3,
      badge: null
    },
    {
      title: 'FAQ',
      description: 'Frequently asked questions about TUTELA',
      href: '/faq',
      icon: FileText,
      badge: null
    }
  ];

  const authenticatedPages = [
    {
      title: 'Dashboard',
      description: 'View your trading activities and performance metrics',
      href: '/dashboard',
      icon: BarChart3,
      badge: 'Active'
    },
    {
      title: 'Commodities',
      description: 'Manage your commodity listings and offers',
      href: '/commodities',
      icon: TrendingUp,
      badge: null
    },
    {
      title: 'Verification',
      description: 'Complete your KYB verification process',
      href: '/verification',
      icon: Shield,
      badge: null
    },
    {
      title: 'Partners',
      description: 'Manage your trusted trading partners',
      href: '/partners',
      icon: Users,
      badge: null
    }
  ];

  const handleGoBack = () => {
    window.history.back();
  };

  const handleSearch = () => {
    // Scroll to top and focus on search if it exists
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Main 404 Card */}
        <Card className="shadow-xl border-0 bg-white">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-6 p-4 bg-blue-100 rounded-full w-fit">
              <Compass className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle className="text-4xl font-bold text-gray-900 mb-4">
              404 - Page Not Found
            </CardTitle>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              Sorry, the page you're looking for doesn't exist or may have been moved.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Button onClick={handleGoBack} variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Button>
              
              <Link href="/">
                <Button className="gap-2">
                  <Home className="w-4 h-4" />
                  Home Page
                </Button>
              </Link>
              
              <Button onClick={handleSearch} variant="outline" className="gap-2">
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>

            {/* Popular Pages Section */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Popular Pages
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {popularPages.map((page) => (
                  <Link key={page.href} href={page.href}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-blue-300">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <page.icon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{page.title}</h4>
                              {page.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {page.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{page.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Authenticated User Pages */}
            {isAuthenticated && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Your Dashboard
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {authenticatedPages.map((page) => (
                    <Link key={page.href} href={page.href}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-emerald-300">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                              <page.icon className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-gray-900">{page.title}</h4>
                                {page.badge && (
                                  <Badge variant="default" className="text-xs bg-emerald-100 text-emerald-800">
                                    {page.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{page.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Help Section */}
            <div className="pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600 mb-3">
                Still can't find what you're looking for?
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/faq">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" />
                    View FAQ
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => window.open('mailto:support@tutela.com?subject=Help%20Request', '_blank')}
                >
                  <Users className="w-4 h-4" />
                  Contact Support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Map Footer */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4 text-center">Site Map</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Platform</h5>
                <ul className="space-y-1 text-gray-600">
                  <li><Link href="/" className="hover:text-blue-600">Home</Link></li>
                  <li><Link href="/demo/request" className="hover:text-blue-600">Demo</Link></li>
                  <li><Link href="/how-it-works" className="hover:text-blue-600">How It Works</Link></li>
                  <li><Link href="/pricing" className="hover:text-blue-600">Pricing</Link></li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Trading</h5>
                <ul className="space-y-1 text-gray-600">
                  <li><Link href="/marketplace" className="hover:text-blue-600">Marketplace</Link></li>
                  <li><Link href="/contracts" className="hover:text-blue-600">Contracts</Link></li>
                  <li><Link href="/orders" className="hover:text-blue-600">Orders</Link></li>
                  <li><Link href="/partners" className="hover:text-blue-600">Partners</Link></li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Account</h5>
                <ul className="space-y-1 text-gray-600">
                  <li><Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link></li>
                  <li><Link href="/verification" className="hover:text-blue-600">Verification</Link></li>
                  <li><Link href="/insights" className="hover:text-blue-600">Insights</Link></li>
                  <li><Link href="/checkout" className="hover:text-blue-600">Checkout</Link></li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Support</h5>
                <ul className="space-y-1 text-gray-600">
                  <li><Link href="/faq" className="hover:text-blue-600">FAQ</Link></li>
                  <li><a href="mailto:support@tutela.com" className="hover:text-blue-600">Contact</a></li>
                  <li><a href="/terms" className="hover:text-blue-600">Terms</a></li>
                  <li><a href="/privacy" className="hover:text-blue-600">Privacy</a></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
