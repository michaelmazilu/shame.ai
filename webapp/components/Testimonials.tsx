"use client";

import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";
import { motion } from "motion/react";

const testimonials = [
  {
    text: "this app is genuinely terrible",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    name: "Priya Deshmukh",
    role: "1 star",
  },
  {
    text: "i lost all my friends. thanks.",
    image: "https://randomuser.me/api/portraits/men/22.jpg",
    name: "Marcus Chen",
    role: "0 friends left",
  },
  {
    text: "worst thing i've ever downloaded",
    image: "https://randomuser.me/api/portraits/women/28.jpg",
    name: "Layla Osman",
    role: "Regretful",
  },
  {
    text: "who approved this. who let this happen.",
    image: "https://randomuser.me/api/portraits/men/35.jpg",
    name: "Jake Moretti",
    role: "Confused",
  },
  {
    text: "this ruined my life and i'm not joking",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Aisha Rahman",
    role: "Destroyed",
  },
  {
    text: "dogshit app. absolute dogshit.",
    image: "https://randomuser.me/api/portraits/men/41.jpg",
    name: "Devon Park",
    role: "Furious",
  },
  {
    text: "my ex has a restraining order on me now",
    image: "https://randomuser.me/api/portraits/women/51.jpg",
    name: "Sofia Reyes",
    role: "Legally banned",
  },
  {
    text: "i want a refund for my dignity",
    image: "https://randomuser.me/api/portraits/men/55.jpg",
    name: "Tomasz Nowak",
    role: "Broken",
  },
  {
    text: "uninstalled. then reinstalled. then cried.",
    image: "https://randomuser.me/api/portraits/women/63.jpg",
    name: "Nkechi Adeyemi",
    role: "In therapy",
  },
  {
    text: "actually evil software",
    image: "https://randomuser.me/api/portraits/men/14.jpg",
    name: "Ethan Briggs",
    role: "Victim",
  },
  {
    text: "i got fired because of this app lmao",
    image: "https://randomuser.me/api/portraits/women/33.jpg",
    name: "Chloe Nakamura",
    role: "Unemployed",
  },
  {
    text: "delete this from the internet please",
    image: "https://randomuser.me/api/portraits/men/47.jpg",
    name: "Rahul Mehta",
    role: "Begging",
  },
  {
    text: "i'm in a groupchat called 'suing shame.ai'",
    image: "https://randomuser.me/api/portraits/women/71.jpg",
    name: "Mei Lin",
    role: "Plaintiff",
  },
  {
    text: "this app owes me an apology",
    image: "https://randomuser.me/api/portraits/men/62.jpg",
    name: "Andre Williams",
    role: "Waiting",
  },
  {
    text: "never downloading anything ever again",
    image: "https://randomuser.me/api/portraits/women/19.jpg",
    name: "Isla Fernandez",
    role: "Done",
  },
];

const col1 = testimonials.slice(0, 3);
const col2 = testimonials.slice(3, 6);
const col3 = testimonials.slice(6, 9);
const col4 = testimonials.slice(9, 12);
const col5 = testimonials.slice(12, 15);

export default function Testimonials() {
  return (
    <section className="bg-white border-y border-beige/40 py-20 relative overflow-hidden">
      <div className="z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto px-6"
        >
          <div className="flex justify-center">
            <div className="border border-beige py-1 px-4 rounded-lg text-sm text-zinc-500">
              Real victims
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tighter mt-5 text-zinc-900">
            Three spins. Zero dignity.
          </h2>
          <p className="text-center mt-5 text-zinc-500">
            Hear from people who&apos;ve survived the wheel.
          </p>
        </motion.div>

        <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden px-6">
          <TestimonialsColumn testimonials={col1} duration={14} />
          <TestimonialsColumn testimonials={col2} duration={18} />
          <TestimonialsColumn testimonials={col3} duration={16} />
          <TestimonialsColumn testimonials={col4} className="hidden md:block" duration={20} />
          <TestimonialsColumn testimonials={col5} className="hidden lg:block" duration={15} />
        </div>
      </div>
    </section>
  );
}
