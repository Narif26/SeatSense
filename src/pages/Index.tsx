import { useState, useEffect, useRef } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { PreferenceSelector } from "@/components/PreferenceSelector";
import { RecommendationCard } from "@/components/RecommendationCard";
import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  text: string;
  isUser: boolean;
  component?: JSX.Element;
}

interface Preferences {
  duration: number;
  groupSize: number;
  useLocation: boolean;
  whiteboard: boolean;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hi! I'm SeatSense\n\nTell me your study needs, and I'll find the best spot nearby on campus.",
      isUser: false,
    },
  ]);
  const [showPreferences, setShowPreferences] = useState(true);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, recommendations]);

  const handlePreferencesSubmit = async (prefs: Preferences) => {
    setShowPreferences(false);
    setIsLoading(true);

    // Add user message
    const prefsText = `Duration: ${prefs.duration} min\nGroup Size: ${prefs.groupSize}\nWhiteboard: ${prefs.whiteboard ? 'Yes' : 'No'}\nUse my location`;
    setMessages((prev) => [
      ...prev,
      { text: prefsText, isUser: true },
      { text: "Finding the best spots for you...", isUser: false },
    ]);

    try {
      // Get user location
      if ('geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);

        // Get recommendations
        const { data, error } = await supabase.functions.invoke('recommend', {
          body: {
            duration: prefs.duration,
            groupSize: prefs.groupSize,
            lat: location.lat,
            lng: location.lng,
          },
        });

        if (error) throw error;

        setRecommendations(data.recommendations);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { text: `Found ${data.recommendations.length} great spots near you!`, isUser: false },
        ]);
      } else {
        throw new Error('Geolocation not supported');
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
      toast.error('Could not get your location', {
        description: 'Please enable location access to find nearby spots.',
      });
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { text: "I couldn't access your location. Please enable location permissions and try again.", isUser: false },
      ]);
      setShowPreferences(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetune = () => {
    setRecommendations([]);
    setShowPreferences(true);
    setMessages((prev) => [
      ...prev,
      { text: "Let's adjust your preferences to find better spots.", isUser: false },
    ]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SeatSense</h1>
              <p className="text-xs text-muted-foreground">OSU Study Spot Finder</p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <div className="space-y-6">
          {/* Messages */}
          {messages.map((message, index) => (
            <ChatBubble
              key={index}
              message={message.text}
              isUser={message.isUser}
            />
          ))}

          {/* Preference Selector */}
          {showPreferences && !isLoading && (
            <PreferenceSelector onSubmit={handlePreferencesSubmit} />
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Top Recommendations</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetune}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Refresh
                </Button>
              </div>
              {recommendations.map((rec, index) => (
                <RecommendationCard
                  key={rec.spot.id}
                  recommendation={rec}
                  rank={index + 1}
                />
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>
    </div>
  );
};

export default Index;