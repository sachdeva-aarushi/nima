import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, MessageSquare, Heart, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { MascotPortrait } from "@/components/MascotPortrait";

export const Route = createFileRoute("/_app/crisis")({
  head: () => ({ meta: [{ title: "Crisis support — Nima" }] }),
  component: CrisisScreen,
});

type Contact = { kind: "call" | "text"; label: string; value: string; href: string };

interface Resource {
  title: string;
  description: string;
  availability: string;
  contact: Contact;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconFg: string;
}

const RESOURCES: Resource[] = [
  {
    title: "Postpartum Support International",
    description:
      "Specialized help for postpartum depression, anxiety, and wellness for new mothers and families.",
    availability: "AVAILABLE 24/7",
    contact: { kind: "call", label: "1-800-944-4773", value: "1-800-944-4773", href: "tel:18009444773" },
    Icon: Sparkles,
    iconBg: "#E6E4F7",
    iconFg: "#7E6BCB",
  },
  {
    title: "988 Suicide & Crisis Lifeline",
    description: "Immediate, free, and confidential support for people in distress and prevention resources.",
    availability: "CALL OR TEXT",
    contact: { kind: "call", label: "988", value: "988", href: "tel:988" },
    Icon: Heart,
    iconBg: "#DDEBDF",
    iconFg: "#5C8B66",
  },
  {
    title: "Crisis Text Line",
    description: "Text-based support for when you need to talk but can't find the words out loud.",
    availability: "TEXT \"HOME\"",
    contact: { kind: "text", label: "741741", value: "741741", href: "sms:741741&body=HOME" },
    Icon: MessageSquare,
    iconBg: "#FFE3DF",
    iconFg: "#D4726D",
  },
  {
    title: "National Maternal Mental Health Hotline",
    description: "A national hotline specifically for pregnant and postpartum individuals struggling with mental health.",
    availability: "AVAILABLE 24/7",
    contact: { kind: "call", label: "1-833-852-6262", value: "1-833-852-6262", href: "tel:18338526262" },
    Icon: Phone,
    iconBg: "#E6E4F7",
    iconFg: "#7E6BCB",
  },
];

function CrisisScreen() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/nima" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl italic text-[#F38B82]" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          Nima
        </h1>
        <span className="h-9 w-9" />
      </header>

      <div className="flex flex-col items-center text-center">
        <MascotPortrait state="comforting" size="lg" />
        <h2 className="mt-5 text-2xl text-[#3D2A28]" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          you are not alone
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#8A6E6B]">
          We're here with you. If you're feeling overwhelmed, reach out to one of these specialized support networks.
        </p>
      </div>

      <ul className="mt-6 space-y-3">
        {RESOURCES.map((r) => (
          <li key={r.title} className="rounded-2xl bg-white p-4 shadow-sm">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ backgroundColor: r.iconBg }}
            >
              <r.Icon className="h-4 w-4" style={{ color: r.iconFg }} strokeWidth={2.2} />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#3D2A28]" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              {r.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#8A6E6B]">{r.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A8908D]">
                {r.availability}
              </span>
              <a
                href={r.contact.href}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#F38B82]"
              >
                {r.contact.kind === "call" ? (
                  <Phone className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                {r.contact.label}
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl bg-[#FFE3DF] p-4 text-center">
        <p className="text-sm italic leading-relaxed text-[#5B403D]">
          "Taking care of yourself is part of taking care of your baby. Your feelings are valid, and reaching out is an act of courage."
        </p>
      </div>

      <a
        href="tel:911"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#F38B82] py-3.5 text-sm font-semibold text-white shadow-md"
      >
        <Phone className="h-4 w-4" /> Call Emergency Support Now
      </a>
    </div>
  );
}
