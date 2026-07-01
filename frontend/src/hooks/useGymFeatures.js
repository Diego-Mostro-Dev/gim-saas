import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGym } from "../services/gym.service";

export function useGymFeatures(featuresFromProps) {
  const queryClient = useQueryClient();
  const shouldFetch = featuresFromProps === undefined;

  const { data: gym, isLoading, error, refetch } = useQuery({
    queryKey: ["gym"],
    queryFn: getGym,
    staleTime: 5 * 60 * 1000,
    enabled: shouldFetch,
  });

  const features = featuresFromProps ?? gym?.features;
  const extrasEnabled = features?.extras === true;

  return { gym, features, extrasEnabled, isLoading, error, refetch, queryClient };
}
