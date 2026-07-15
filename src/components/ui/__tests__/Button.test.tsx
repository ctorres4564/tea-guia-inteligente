import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui";

describe("Button", () => {
  it("renderiza o texto informado", () => {
    render(<Button>Entrar</Button>);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("fica desabilitado durante carregamento", () => {
    render(<Button isLoading>Enviar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("chama onClick quando clicado", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clique</Button>);
    screen.getByRole("button").click();
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
