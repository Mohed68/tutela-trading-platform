import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, TrendingUp, Users, Zap, ChevronRight, CheckCircle, ShoppingCart } from "lucide-react";
import TutelaLogo from "@/components/common/TutelaLogo";
import { ROUTES } from "@/config/routes";

export default function Landing() {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate(ROUTES.dashboard);
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
            <span style={{ color: 'var(--tutela-secondary)' }}>Secure Physical Commodity Trading</span>
            <br />
            <span className="bg-gradient-to-r from-gray-800 to-blue-600 bg-clip-text text-transparent">
              with AI & Blockchain
            </span>
          </h1>
          <p className="text-xl mb-8 leading-relaxed" style={{ color: 'var(--tutela-gray-800)' }}>
