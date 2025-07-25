import logoImage from "@assets/photo_5774014584200481752_x_1753464795318.jpg";

interface TutelaLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export default function TutelaLogo({ size = "md", showText = true, className = "" }: TutelaLogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10", 
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl", 
    xl: "text-3xl"
  };

  return (
    <div className={`tutela-logo ${className}`}>
      <div className="relative">
        <img 
          src={logoImage} 
          alt="TUTELA Logo" 
          className={`${sizeClasses[size]} object-contain rounded-lg shadow-lg`}
        />
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-gray-800 to-blue-600 bg-clip-text text-transparent`}>
          TUTELA
        </span>
      )}
    </div>
  );
}