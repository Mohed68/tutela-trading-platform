import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UserPreferences {
  language?: string;
  timezone?: string;
  notifications?: any;
  currency?: string;
}

export function useSecurePreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePreferences = useMutation({
    mutationFn: async (preferences: UserPreferences) => {
      return await apiRequest("/api/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: (updatedUser) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved successfully.",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
    error: updatePreferences.error,
  };
}