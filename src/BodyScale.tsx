import { createLucideIcon } from "lucide-react";

const BodyScale = createLucideIcon("BodyScale", [
  ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "4", key: "body" }],
  ["path", { d: "M8 10a4 4 0 0 1 8 0Z", key: "dial" }],
  ["path", { d: "m12 10 1.5-2M8 15v2m8-2v2", key: "marks" }],
]);

export default BodyScale;
