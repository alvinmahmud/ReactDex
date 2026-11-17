import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("@/components/PokemonCard", () => ({
  __esModule: true,
  default: () => <div data-testid="pokemon-card">Pokémon card</div>,
}));

test("renders the Pokédex logo using the deployment base and includes the card", () => {
  render(<App />);
  expect(screen.getByRole("img", { name: "Pokedex" })).toHaveAttribute(
    "src", "/ReactDex/images/pokedex.png",
  );
  expect(screen.getByTestId("pokemon-card")).toBeInTheDocument();
});
