import { apiRequest } from '@/services/api-client';
import type { PropertySummary } from '@/types/property';

interface FavouritePropertiesResponse {
  success: true;
  favourites: PropertySummary[];
}

interface FavouriteIdsResponse {
  success: true;
  favourites: unknown[];
}

/**
 * Every property this user has saved.
 *
 * Filters defensively for two separate reasons. A malformed body should yield
 * an empty list rather than crash a screen — the same rule `getProperties`
 * follows. And `populate` silently DROPS references to deleted properties,
 * which is benign, but a null slipping through would reach a card component
 * that expects a real property.
 *
 * @param token The Varlikent JWT. Required — the route is behind `protect`.
 */
export async function getFavourites(token: string): Promise<PropertySummary[]> {
  const response = await apiRequest<FavouritePropertiesResponse>('/users/favourites', { token });

  if (!Array.isArray(response?.favourites)) return [];

  return response.favourites.filter(
    (property): property is PropertySummary => Boolean(property) && Boolean(property?._id)
  );
}

export async function addFavourite(token: string, propertyId: string): Promise<void> {
  await apiRequest<FavouriteIdsResponse>(`/users/favourites/${propertyId}`, {
    method: 'POST',
    token,
  });
}

export async function removeFavourite(token: string, propertyId: string): Promise<void> {
  await apiRequest<FavouriteIdsResponse>(`/users/favourites/${propertyId}`, {
    method: 'DELETE',
    token,
  });
}
