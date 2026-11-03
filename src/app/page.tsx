"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/app/actions";
import cooking from "@/assets/landing/cooking.jpg";
import family from "@/assets/landing/family.jpg";
import groceries from "@/assets/landing/groceries.jpg";
import produce from "@/assets/landing/produce.jpg";
import { GoogleButton } from "@/components/GoogleButton";
import { usePlanner } from "@/components/PlannerProvider";

const STEPS = [
  { title: "Set up", text: "Say who is eating: adults, younger kids and teenagers." },
  { title: "Meals", text: "Pick the week from 33 family meals, or type any meal." },
  { title: "Approve", text: "The other adults approve by email in one click." },
  { title: "Review", text: "Every grocery line shows its math. Untick what you have." },
  { title: "Shop", text: "The list lands in your Instacart family cart." },
];

const FEATURES = [
  {
    img: cooking,
    alt: "Hands chopping vegetables on a cutting board",
    title: "Any meal, in plain words",
    text: "Type a meal the way you would say it. Muse Spark turns it into ingredients per serving and asks one short question when a meal could go two ways.",
  },
  {
    img: produce,
    alt: "Cauliflower, broccoli, radishes and onions at a market stall",
    title: "Exact amounts, real packs",
    text: "Tested code scales each ingredient to your household, merges shared ingredients across meals and rounds up to the packs stores actually sell.",
  },
  {
    img: groceries,
    alt: "Fresh eggs, tomatoes and greens on a kitchen counter",
    title: "Straight to your Instacart cart",
    text: "The list goes to your Instacart family cart and you check out yourself. The planner never places or pays for an order.",
  },
];

export default function LandingPage() {
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            Plan the meals. The groceries take care of themselves.
          </h1>
          <p className="mt-4 text-lg text-ink-2">
            Pick the week&apos;s meals and say who is eating. Family Meal Planner works out exact grocery quantities for
            your household, rounds up to real pack sizes and hands the list to your Instacart family cart.
          </p>
          <Start />
        </div>
        <Image
          src={family}
          alt="A family eating dinner together at the table"
          loading="eager"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-[4/3] w-full rounded-2xl object-cover"
        />
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">How it works</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-dark">
                {i + 1}
              </div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="card overflow-hidden">
            <Image src={f.img} alt={f.alt} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[3/2] w-full object-cover" />
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          </article>
        ))}
      </section>

      <p className="text-center text-sm text-muted">
        Google sign in shares only your name and email: no passwords, and no access to your Gmail, Calendar or Drive.
      </p>
    </div>
  );
}

function Start() {
  const { user, googleConfigured, startDemo, loading } = usePlanner();
  const router = useRouter();

  if (loading) return <div className="mt-6 h-11" />;

  // Signed out visitors run the demo automatically, so only a signed in user skips the choice.
  if (user) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href="/setup" className="btn btn-primary">
          Open your planner
        </Link>
        <span className="text-sm text-muted">Signed in as {user.email}</span>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <form action={signInWithGoogle}>
        <GoogleButton disabled={!googleConfigured} />
      </form>
      <button
        onClick={() => {
          startDemo();
          router.push("/setup");
        }}
        className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
      >
        Try the demo without signing in
      </button>
    </div>
  );
}
