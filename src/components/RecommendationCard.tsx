import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Volume2, Clock, AlertCircle, TrendingUp, Wifi } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Recommendation {
  spot: {
    id: string;
    name: string;
    building: string;
    floor: string;
  };
  status: {
    occupancy_percent: number | null;
    noise_level: string | null;
    updated_at: string;
    source: string;
    wifi_latency: number | null;
  } | null;
  distance: number;
  warnings: string[];
  matchReason: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  rank: number;
}

export const RecommendationCard = ({ recommendation, rank }: RecommendationCardProps) => {
  const { spot, status, distance, warnings, matchReason } = recommendation;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [occupancy, setOccupancy] = useState(status?.occupancy_percent || 50);
  const [noiseLevel, setNoiseLevel] = useState<'Quiet' | 'Medium' | 'Loud' | null>(
    (status?.noise_level as 'Quiet' | 'Medium' | 'Loud') || null
  );
  const [lastUpdated, setLastUpdated] = useState(status?.updated_at || new Date().toISOString());
  const [displayOccupancy, setDisplayOccupancy] = useState(status?.occupancy_percent || null);
  const [displayNoiseLevel, setDisplayNoiseLevel] = useState(status?.noise_level || null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const timeSinceUpdate = Math.round((Date.now() - new Date(lastUpdated).getTime()) / 60000);

  // Convert distance to miles and walking time
  const distanceMiles = (distance * 0.000621371).toFixed(2); // meters to miles
  const walkingMinutes = Math.round(distance / 80); // ~80m per minute walking speed

  const handleSubmitUpdate = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-status', {
        body: {
          spotId: spot.id,
          occupancyPercent: occupancy,
          noiseLevel: noiseLevel,
        },
      });

      if (error) throw error;

      // Update local state with new values
      setLastUpdated(new Date().toISOString());
      setDisplayOccupancy(occupancy);
      setDisplayNoiseLevel(noiseLevel);
      setIsDialogOpen(false);

      toast.success('Thanks for the update!', {
        description: 'Your feedback helps other students find the best spots.',
      });
    } catch (error) {
      console.error('Error submitting update:', error);
      toast.error('Failed to submit update', {
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-5 space-y-4 hover:shadow-md transition-shadow animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-semibold">
              #{rank}
            </Badge>
            <h3 className="font-semibold text-base leading-tight">{spot.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {spot.building} • {spot.floor}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-2 text-sm">
          <div className={`p-1.5 rounded-lg ${displayOccupancy !== null ? 'bg-primary/10' : 'bg-muted'}`}>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">
              {displayOccupancy !== null
                ? `${displayOccupancy}% full`
                : 'Unknown'}
            </div>
            <div className="text-xs text-muted-foreground">Occupancy</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className={`p-1.5 rounded-lg ${displayNoiseLevel ? 'bg-accent/10' : 'bg-muted'}`}>
            <Volume2 className="w-4 h-4 text-accent" />
          </div>
          <div>
            <div className="font-medium">{displayNoiseLevel || 'Unknown'}</div>
            <div className="text-xs text-muted-foreground">Noise Level</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="p-1.5 rounded-lg bg-secondary">
            <MapPin className="w-4 h-4 text-secondary-foreground" />
          </div>
          <div>
            <div className="font-medium">{distanceMiles} mi • {walkingMinutes} min</div>
            <div className="text-xs text-muted-foreground">Walking distance</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="p-1.5 rounded-lg bg-secondary">
            <Clock className="w-4 h-4 text-secondary-foreground" />
          </div>
          <div>
            <div className="font-medium">{timeSinceUpdate}m ago</div>
            <div className="text-xs text-muted-foreground">Last updated</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className={`p-1.5 rounded-lg ${status?.wifi_latency ? 'bg-green-50 dark:bg-green-950/20' : 'bg-muted'}`}>
            <Wifi className="w-4 h-4 text-green-600 dark:text-green-500" />
          </div>
          <div>
            <div className="font-medium">
              {status?.wifi_latency ? `${status.wifi_latency}ms` : 'Unknown'}
            </div>
            <div className="text-xs text-muted-foreground">WiFi Latency</div>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {warnings.join(' • ')}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
        <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-primary">
          <span className="font-medium">Why this matched:</span> {matchReason}
        </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            Submit Quick Update
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Spot Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Occupancy: {occupancy}%</label>
              <Slider
                value={[occupancy]}
                onValueChange={(v) => setOccupancy(v[0])}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Noise Level</label>
              <div className="flex gap-2">
                {(['Quiet', 'Medium', 'Loud'] as const).map((level) => (
                  <Badge
                    key={level}
                    variant={noiseLevel === level ? "default" : "outline"}
                    className="cursor-pointer px-4 py-2 flex-1 justify-center"
                    onClick={() => setNoiseLevel(level)}
                  >
                    {level}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmitUpdate}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};