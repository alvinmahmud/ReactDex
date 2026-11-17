import { Pokemon } from "@/types/pokemon";

const API_BASE = "https://pokeapi.co/api/v2";

export interface PokemonSearchEntry {
  name: string;
  id: number;
}

let pokemonIndex: Promise<PokemonSearchEntry[]> | undefined;

export const getPokemonIndex = (): Promise<PokemonSearchEntry[]> => {
  if (!pokemonIndex) {
    // Share one lightweight index request, including across Strict Mode mounts.
    pokemonIndex = fetch(`${API_BASE}/pokemon?limit=100000`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load Pokémon suggestions");
        const data: { results: { name: string; url: string }[] } =
          await response.json();
        return data.results.map(({ name, url }) => ({
          name,
          id: Number(url.split("/").filter(Boolean).pop()),
        }));
      })
      .catch((error: unknown) => {
        pokemonIndex = undefined;
        throw error;
      });
  }
  return pokemonIndex;
};

export const getPokemonByName = async (
  name: string,
): Promise<Pokemon | null> => {
  try {
    const response = await fetch(`${API_BASE}/pokemon/${name.toLowerCase()}`);

    if (!response.ok) {
      throw new Error(`Failed to get data for ${name}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      name: data.name,
      sprites: {
        frontSprite: data.sprites?.front_default || "",
        officialArtwork:
          data.sprites?.other?.["official-artwork"]?.front_default || "",
      },
      types: Array.isArray(data.types)
        ? data.types.map(
            (typeInfo: { type: { name: string } }) => typeInfo.type.name,
          )
        : [],
    };
  } catch (error) {
    console.error(`Error getting data for ${name}:`, error);
    return null;
  }
};
