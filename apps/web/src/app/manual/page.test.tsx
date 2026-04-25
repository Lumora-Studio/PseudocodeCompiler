import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ManualPage from "@/app/manual/page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("ManualPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses a dedicated mobile-safe scroll container", () => {
    render(<ManualPage />);

    const main = screen.getByRole("main");
    expect(main.className).toContain("overflow-y-auto");
    expect(main.className).toContain("overscroll-contain");
    expect(main).toHaveStyle({
      minHeight: "100dvh",
      touchAction: "pan-y",
    });
  });

  it("keeps the back link to the compiler available", () => {
    render(<ManualPage />);

    const backLinks = screen.getAllByRole("link", { name: "Back to Pseudocode Compiler" });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0]).toHaveAttribute("href", "/");
  });
});
