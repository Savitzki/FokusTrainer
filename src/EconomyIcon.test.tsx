import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import CapiWheyToken from "./CapiWheyToken";
import ProteinToken from "./ProteinToken";
import MedicalKitIcon from "./MedicalKitIcon";
import CapiWheyAmount from "./CapiWheyAmount";
import { ECONOMY_ASSETS } from "./EconomyIcon";

it("usa as artes oficiais existentes e mantém moeda e consumível distintos", () => {
  const { container } = render(
    <>
      <CapiWheyToken />
      <ProteinToken />
      <MedicalKitIcon />
    </>,
  );
  const images = Array.from(container.querySelectorAll("img"));
  expect(images.map((image) => image.getAttribute("src"))).toEqual([
    `/${ECONOMY_ASSETS.capiwhey}`,
    `/${ECONOMY_ASSETS.capiwhey}`,
    `/${ECONOMY_ASSETS.medicalKit}`,
  ]);
  expect(container.querySelector("svg")).toBeNull();
  for (const path of Object.values(ECONOMY_ASSETS)) {
    expect(Object.keys(import.meta.glob("/public/images/web/*.webp"))).toContain(
      `/public/${path}`,
    );
  }
  for (const image of images) {
    expect(image).toHaveAttribute("alt", "");
    expect(image.parentElement).toHaveAttribute("aria-hidden", "true");
  }
});

it.each([18, 22, 34])(
  "reserva uma caixa de %d px sem aplicar recorte à arte",
  (size) => {
    const { container } = render(<CapiWheyToken size={size} />);
    expect(container.firstChild).toHaveStyle({
      width: `${size}px`,
      height: `${size}px`,
    });
    expect(container.querySelector("img")).toHaveAttribute(
      "width",
      String(size),
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "height",
      String(size),
    );
  },
);

it.each([
  { amount: 250, signed: false, value: "250" },
  { amount: 10, signed: true, value: "+10" },
  { amount: -50, signed: true, value: "-50" },
  { amount: 12345, signed: false, value: "12.345" },
])(
  "apresenta ícone e valor, com unidade somente no nome acessível: $value",
  ({ amount, signed, value }) => {
    render(<CapiWheyAmount amount={amount} signed={signed} />);
    const amountView = screen.getByRole("img", { name: `${value} CapiWhey` });
    expect(amountView).toHaveTextContent(value);
    expect(
      within(amountView).queryByText(/CapiWhey|potes|moedas/),
    ).not.toBeInTheDocument();
    expect(amountView.querySelector("img")).toHaveAttribute(
      "src",
      `/${ECONOMY_ASSETS.capiwhey}`,
    );
  },
);
